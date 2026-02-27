import json

from fastapi import APIRouter, Depends, HTTPException

from config import settings
from db.neo4j_driver import get_session
from models.submission import SubmitRequest, SubmissionOut
from services.auth_service import get_current_user
from services import yutori_agent

router = APIRouter()


@router.post("/{claim_id}/submit", response_model=SubmissionOut, status_code=201)
async def submit_claim(
    claim_id: str,
    body: SubmitRequest,
    user_id: str = Depends(get_current_user),
):
    """Trigger Yutori web form submission for a completed claim."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim {id: $claim_id})
            OPTIONAL MATCH (c)-[:PRODUCED]->(cd:ClaimData)
            OPTIONAL MATCH (c)-[:HAS_EVIDENCE]->(e:EvidenceAsset)
            OPTIONAL MATCH (c)-[:FOR]->(v:Vehicle)
            RETURN c, cd, collect(e) AS evidence, v
            """,
            user_id=user_id,
            claim_id=claim_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="Claim not found")

    c = record["c"]
    if c["status"] not in ("complete",):
        raise HTTPException(
            status_code=400,
            detail=f"Claim must be in 'complete' status before submission (current: {c['status']})",
        )

    # Reconstruct enough context to build Yutori task
    cd = record["cd"]
    evidence_assets = record["evidence"]

    from models.evidence import Clip, EvidenceBundle
    from models.claim_json import ClaimJSON, VehicleIdentity, DamageMap, HazardDrivability, SubmissionPack, RoutingDecision

    clips = [
        Clip(
            clip_type=e["clip_type"],
            clip_id=e["clip_id"],
            clip_url=e.get("clip_url") or "",
            caption=e.get("caption") or "",
            start_s=e["start_s"],
            end_s=e["end_s"],
            confidence=e["confidence"],
        )
        for e in evidence_assets if e
    ]
    bundle = EvidenceBundle(session_id=c["session_id"], video_id=claim_id, tags=[], clips=clips)

    routing_data = json.loads(cd["routing_json"]) if cd and cd.get("routing_json") else {}
    claim_json = ClaimJSON(
        vehicle_identity=VehicleIdentity(**json.loads(cd["vehicle_json"])) if cd and cd.get("vehicle_json") else VehicleIdentity(),
        damage_map=DamageMap(**json.loads(cd["incident_json"])) if cd and cd.get("incident_json") else DamageMap(),
        hazards=HazardDrivability(**json.loads(cd["incident_json"])) if cd and cd.get("incident_json") else HazardDrivability(),
        submission_pack=SubmissionPack(**json.loads(cd["evidence_json"])) if cd and cd.get("evidence_json") else SubmissionPack(),
        routing=RoutingDecision(**routing_data) if routing_data else RoutingDecision(lane=c.get("lane", "SHOP_ESTIMATE"), coverage_score=c.get("coverage_score", 0), fraud_risk=c.get("fraud_risk", "low")),
    )

    url = body.destination_url or settings.insurance_portal_url

    task_desc = yutori_agent.build_task_description(
        claim_json, bundle, url, c.get("incident_date", "Unknown date")
    )
    yutori_task_id = await yutori_agent.create_yutori_task(task_desc, f"{url}/login")

    async with get_session() as session:
        submission_id = await yutori_agent.create_submission_node(
            session, claim_id, yutori_task_id, url
        )

    return SubmissionOut(
        id=submission_id,
        destination_url=url,
        yutori_task_id=yutori_task_id,
        status="pending",
    )


@router.get("/{claim_id}/submission", response_model=SubmissionOut)
async def get_submission_status(claim_id: str, user_id: str = Depends(get_current_user)):
    """Get the current Yutori submission status for a claim."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim {id: $claim_id})-[:RESULTED_IN]->(s:Submission)
            RETURN s ORDER BY s.submitted_at DESC LIMIT 1
            """,
            user_id=user_id,
            claim_id=claim_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="No submission found for this claim")

    s = record["s"]
    return SubmissionOut(
        id=s["id"],
        destination_url=s["destination_url"],
        yutori_task_id=s.get("yutori_task_id"),
        confirmation_id=s.get("confirmation_id"),
        insure_co_claim_id=s.get("insure_co_claim_id"),
        scout_id=s.get("scout_id"),
        scout_status=s.get("scout_status"),
        status=s["status"],
        submitted_at=str(s.get("submitted_at", "")),
    )
