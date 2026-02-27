"""
APScheduler setup for background jobs.
No Celery, no Docker — runs inside the FastAPI process.
"""
import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

log = logging.getLogger("swiftsettle.scheduler")

from db.neo4j_driver import get_session
from utils.sse import push_event

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    scheduler.add_job(poll_yutori_jobs, "interval", minutes=5, id="poll_yutori")
    scheduler.add_job(poll_scout_jobs, "interval", minutes=2, id="poll_scouts")
    scheduler.start()


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)


async def process_video_job(claim_id: str, user_id: str) -> None:
    """
    Full pipeline: Reka URL indexing → metadata extraction → evidence → GLiNER2 → Policy Engine → SSE.
    Enqueued immediately after POST /claims/new.
    """
    from services import (
        reka_compiler,
        fastino_brain,
        policy_engine,
        ingestion,
    )

    log.info("[%s] Pipeline started", claim_id[:8])
    async with get_session() as session:
        try:
            # 1. Mark as processing
            await ingestion.update_claim_status(session, claim_id, "processing")
            await push_event(claim_id, "status_update", {"status": "processing", "step": "indexing_with_reka"})
            log.info("[%s] Step 1/6: Indexing video with Reka", claim_id[:8])

            # Fetch video_url and session_id from Neo4j
            result = await session.run(
                "MATCH (c:Claim {id: $claim_id}) RETURN c.video_url AS video_url, c.session_id AS session_id",
                claim_id=claim_id,
            )
            record = await result.single()
            video_url = record["video_url"]
            session_id = record["session_id"]

            # 2. Index video URL with Reka + wait for indexing
            video_id = await reka_compiler.index_video_url(video_url)
            await push_event(claim_id, "status_update", {"status": "processing", "step": "indexing_video"})
            await reka_compiler.wait_for_indexing(video_id)

            log.info("[%s] Step 2/6: Video indexed (video_id=%s). Running parallel analysis...", claim_id[:8], video_id[:8] if video_id else "None")
            # 3. Run all analysis in parallel:
            #    a. extract_claim_metadata — gets incident_type, VIN, make/model, location, damage_summary
            #    b. search_shot_types — finds segment timestamps for evidence clips
            #    c. analyze_damage — detailed damage Q&A for GLiNER2
            #    d. get_video_tags — keywords/description
            await push_event(claim_id, "status_update", {"status": "processing", "step": "extracting_evidence"})
            metadata, segments, damage_analysis, tags_data = await asyncio.gather(
                reka_compiler.extract_claim_metadata(video_id),
                reka_compiler.search_shot_types(video_id),
                reka_compiler.analyze_damage(video_id),
                reka_compiler.get_video_tags(video_id),
            )

            # 4. Update Claim node with extracted metadata
            extracted_description = metadata.get("damage_summary") or ""
            await ingestion.update_claim_metadata(
                session,
                claim_id=claim_id,
                incident_type=metadata.get("incident_type") or "other",
                incident_location=metadata.get("incident_location"),
                description=extracted_description,
            )
            await push_event(claim_id, "status_update", {"status": "processing", "step": "analyzing_damage"})

            # 5. Auto-link vehicle from extracted VIN (deferred from claim creation)
            extracted_vin = metadata.get("vin")
            vehicle_linked = await ingestion.link_vehicle_to_claim(
                session,
                claim_id=claim_id,
                user_id=user_id,
                vin=extracted_vin,
                make=metadata.get("vehicle_make"),
                model=metadata.get("vehicle_model"),
                year=metadata.get("vehicle_year"),
                license_plate=metadata.get("license_plate"),
            )

            log.info("[%s] Step 3/6: Analysis complete. incident_type=%s, vin=%s. Generating clips...", claim_id[:8], metadata.get("incident_type"), metadata.get("vin") or "none")
            # 6. Generate highlight clips via Reka /v1/clips (no ffmpeg)
            clips = await reka_compiler.generate_highlight_clips(video_url, claim_id)
            await reka_compiler.store_evidence_nodes(session, claim_id, clips)

            bundle = reka_compiler.build_evidence_bundle(session_id, video_id, tags_data, clips)
            await push_event(claim_id, "status_update", {
                "status": "processing",
                "step": "auto_classifying",
                "clip_count": len(clips),
            })

            log.info("[%s] Step 4/6: %d clips generated. Running GLiNER2 extraction...", claim_id[:8], len(clips))
            # 7. GLiNER2 four-contract extraction
            gliner_text = fastino_brain.build_gliner_input(bundle, damage_analysis)
            adapter_path = fastino_brain.select_adapter(bundle)
            raw_output = await fastino_brain.extract_claim(
                gliner_text,
                adapter_path,
                is_high_stakes=False,
            )
            claim_json = fastino_brain.parse_claim_json(raw_output, bundle)

            # 8. Policy engine: score + fraud check + lane routing
            await push_event(claim_id, "status_update", {"status": "processing", "step": "scoring_coverage"})
            score = policy_engine.compute_coverage_score(bundle, claim_json)

            effective_vin = extracted_vin or "__no_vin__"
            fraud_risk = await policy_engine.fraud_check(session, effective_vin, user_id)

            # No VIN → force adjuster lane regardless of score
            if not vehicle_linked:
                from models.claim_json import RoutingDecision
                routing = RoutingDecision(
                    lane="HUMAN_ADJUSTER",
                    coverage_score=score,
                    fraud_risk=fraud_risk,
                    review_reasons=["VIN not visible in video — manual vehicle verification required"],
                    recapture_hint="Record the VIN plate near the driver door jamb for 3 seconds, steady close-up.",
                )
            else:
                missing = policy_engine._get_missing_fields(claim_json, bundle)
                routing = policy_engine.apply_lane_rules(claim_json, score, fraud_risk, missing)

            claim_json.routing = routing

            # 9. Store ClaimData node
            await fastino_brain.store_claim_data(session, claim_id, claim_json)

            # 10. Update Claim node with final results
            await ingestion.update_claim_result(session, claim_id, routing.lane, score, fraud_risk)

            # 11. Save training example
            adapter_type = "collision"
            if adapter_path:
                for name in ("hail", "glass_only", "tow_risk"):
                    if name in (adapter_path or ""):
                        adapter_type = name
                        break
            fastino_brain.save_training_example(gliner_text, raw_output, claim_id, adapter_type)

            # 12. Log extraction results
            reka_compiler.log_extraction_results(
                claim_id=claim_id,
                metadata=metadata,
                segments=segments,
                damage_analysis=damage_analysis,
                clips=clips,
                claim_json=claim_json.model_dump(),
                tags_data=tags_data,
                gliner_input=gliner_text,
                gliner_raw_output=raw_output,
            )

            log.info("[%s] Step 6/6: COMPLETE. lane=%s, score=%s, clips=%d", claim_id[:8], routing.lane, score, len(clips))
            # 13. SSE: notify frontend processing is complete
            await push_event(claim_id, "processing_complete", {
                "status": "complete",
                "lane": routing.lane,
                "coverage_score": score,
                "fraud_risk": fraud_risk,
                "clip_count": len(clips),
                "clip_urls": [c["clip_url"] for c in clips if c.get("clip_url")],
                "incident_type": metadata.get("incident_type") or "other",
                "vin_found": bool(extracted_vin),
            })

        except Exception as exc:
            log.exception("[%s] Pipeline FAILED: %s", claim_id[:8], exc)
            await ingestion.update_claim_status(session, claim_id, "failed")
            await push_event(claim_id, "error", {"status": "failed", "detail": str(exc)})
            raise


async def poll_yutori_jobs() -> None:
    """
    Periodic job: check all pending Yutori submissions and update their status.
    After success, extract insure_co_claim_id and create a Scout.
    Runs every 5 minutes via APScheduler.
    """
    from services.yutori_agent import (
        poll_yutori_task,
        update_submission_status,
        create_scout,
    )
    from config import settings

    async with get_session() as session:
        result = await session.run(
            """
            MATCH (c:Claim)-[:RESULTED_IN]->(s:Submission)
            WHERE s.status IN ['pending', 'queued', 'running']
            RETURN s.yutori_task_id AS task_id, s.id AS submission_id,
                   c.id AS claim_id
            """
        )
        records = await result.data()

    for record in records:
        try:
            task_data = await poll_yutori_task(record["task_id"])
            yutori_status = task_data.get("status", "unknown")
            confirmation_id = None
            insure_co_claim_id = None
            scout_id = None

            if yutori_status == "succeeded":
                result_data = task_data.get("result", {})
                output = result_data.get("output") or result_data
                confirmation_id = (
                    output.get("confirmation_number")
                    or result_data.get("confirmation_number")
                    or result_data.get("reference_id")
                )
                insure_co_claim_id = (
                    output.get("insure_co_claim_id")
                    or result_data.get("insure_co_claim_id")
                )

                # Create Scout to monitor approval
                if insure_co_claim_id:
                    try:
                        scout_id = await create_scout(
                            insure_co_claim_id,
                            settings.insurance_portal_url,
                            "clickaskipid@gmail.com",
                        )
                        # Store scout_id on Submission node
                        async with get_session() as session:
                            await session.run(
                                "MATCH (s:Submission {yutori_task_id: $task_id}) SET s.scout_id = $scout_id",
                                task_id=record["task_id"],
                                scout_id=scout_id,
                            )
                    except Exception:
                        pass  # Scout creation is best-effort

            async with get_session() as session:
                await update_submission_status(
                    session,
                    record["task_id"],
                    yutori_status,
                    confirmation_id,
                    insure_co_claim_id,
                    scout_id,
                )

            if yutori_status in ("succeeded", "failed"):
                await push_event(record["claim_id"], "submission_update", {
                    "status": yutori_status,
                    "confirmation_id": confirmation_id,
                    "insure_co_claim_id": insure_co_claim_id,
                })

        except Exception:
            continue  # Don't fail the whole poll job for one task


async def poll_scout_jobs() -> None:
    """
    Periodic job: check all pending Scout submissions for approval.
    Runs every 2 minutes via APScheduler.
    """
    from services.yutori_agent import poll_scout

    async with get_session() as session:
        result = await session.run(
            """
            MATCH (c:Claim)-[:RESULTED_IN]->(s:Submission)
            WHERE s.scout_id IS NOT NULL
              AND NOT s.scout_status IN ['succeeded', 'failed']
            RETURN s.scout_id AS scout_id, s.id AS submission_id,
                   c.id AS claim_id, s.yutori_task_id AS task_id
            """
        )
        records = await result.data()

    for record in records:
        try:
            scout_data = await poll_scout(record["scout_id"])
            scout_status = scout_data.get("status", "unknown")

            async with get_session() as session:
                await session.run(
                    """
                    MATCH (s:Submission {scout_id: $scout_id})
                    SET s.scout_status = $scout_status
                    """,
                    scout_id=record["scout_id"],
                    scout_status=scout_status,
                )

                if scout_status == "succeeded":
                    await session.run(
                        """
                        MATCH (s:Submission {scout_id: $scout_id})
                        SET s.status = 'succeeded'
                        """,
                        scout_id=record["scout_id"],
                    )

            if scout_status == "succeeded":
                await push_event(record["claim_id"], "submission_update", {
                    "status": "succeeded",
                    "scout_status": scout_status,
                })

        except Exception:
            continue  # Don't fail the whole poll job for one scout


def enqueue_process_video(claim_id: str, user_id: str) -> None:
    """Schedule process_video_job to run immediately (one-off job)."""
    scheduler.add_job(
        process_video_job,
        args=[claim_id, user_id],
        id=f"process_video_{claim_id}",
        replace_existing=True,
    )
