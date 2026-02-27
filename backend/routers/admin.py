import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.neo4j_driver import get_session
from services.auth_service import get_admin_user
from tasks.scheduler import scheduler

router = APIRouter()


class OutcomeLabel(BaseModel):
    final_lane: str
    final_severity: str
    adjuster_notes: str = ""


class TrainRequest(BaseModel):
    num_epochs: int = 10
    learning_rate: float = 1e-5
    batch_size: int = 8


@router.get("/claims")
async def list_all_claims(
    status: str | None = None,
    lane: str | None = None,
    fraud_risk: str | None = None,
    skip: int = 0,
    limit: int = 50,
    _admin: str = Depends(get_admin_user),
):
    """List all claims with optional filters. Admin only."""
    filters = []
    params: dict = {"skip": skip, "limit": limit}

    if status:
        filters.append("c.status = $status")
        params["status"] = status
    if lane:
        filters.append("c.lane = $lane")
        params["lane"] = lane
    if fraud_risk:
        filters.append("c.fraud_risk = $fraud_risk")
        params["fraud_risk"] = fraud_risk

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

    async with get_session() as session:
        result = await session.run(
            f"""
            MATCH (u:User)-[:FILED]->(c:Claim)-[:FOR]->(v:Vehicle)
            {where_clause}
            RETURN c, u.email AS user_email, v.vin AS vin
            ORDER BY c.filed_at DESC
            SKIP $skip LIMIT $limit
            """,
            **params,
        )
        records = await result.data()

    return [
        {
            "id": r["c"]["id"],
            "status": r["c"]["status"],
            "lane": r["c"].get("lane"),
            "coverage_score": r["c"].get("coverage_score"),
            "fraud_risk": r["c"].get("fraud_risk"),
            "filed_at": str(r["c"]["filed_at"]),
            "user_email": r["user_email"],
            "vin": r["vin"],
        }
        for r in records
    ]


@router.patch("/claims/{claim_id}/outcome")
async def label_outcome(
    claim_id: str,
    body: OutcomeLabel,
    _admin: str = Depends(get_admin_user),
):
    """
    Adjuster labels the final outcome.
    Creates Outcome node, links to Claim, updates JSONL training file in-place.
    """
    outcome_id = str(uuid.uuid4())

    async with get_session() as session:
        # Verify claim exists
        result = await session.run(
            "MATCH (c:Claim {id: $claim_id}) RETURN c",
            claim_id=claim_id,
        )
        record = await result.single()
        if not record:
            raise HTTPException(status_code=404, detail="Claim not found")

        await session.run(
            """
            MATCH (c:Claim {id: $claim_id})
            CREATE (o:Outcome {
                id: $outcome_id,
                final_lane: $final_lane,
                final_severity: $final_severity,
                adjuster_notes: $adjuster_notes,
                labeled_at: datetime()
            })
            CREATE (o)-[:RESOLVES]->(c)
            SET c.lane = $final_lane
            """,
            claim_id=claim_id,
            outcome_id=outcome_id,
            final_lane=body.final_lane,
            final_severity=body.final_severity,
            adjuster_notes=body.adjuster_notes,
        )

        # Fetch the training example and update its output with adjuster-confirmed label
        gliner_result = await session.run(
            """
            MATCH (c:Claim {id: $claim_id})-[:PRODUCED]->(cd:ClaimData)
            RETURN cd
            """,
            claim_id=claim_id,
        )
        cd_record = await gliner_result.single()

    # Update JSONL training example with confirmed outcome (append + dedup by claim_id)
    if cd_record:
        _update_training_example(claim_id, body.final_lane, body.final_severity)

    return {"outcome_id": outcome_id, "claim_id": claim_id, "final_lane": body.final_lane}


def _update_training_example(claim_id: str, final_lane: str, final_severity: str) -> None:
    """
    Update the training JSONL: append a corrected entry with the new true_label.
    Deduplication by claim_id happens at training time (last entry wins).
    """
    training_dir = Path(__file__).parent.parent.parent / "training_data"
    training_dir.mkdir(exist_ok=True)

    # Search all adapter JSONL files for this claim_id
    for jsonl_file in training_dir.glob("*.jsonl"):
        if jsonl_file.name == "corrections.jsonl":
            continue
        lines = []
        found = False
        try:
            with open(jsonl_file) as f:
                lines = f.readlines()
        except OSError:
            continue

        for line in lines:
            try:
                entry = json.loads(line.strip())
                if entry.get("claim_id") == claim_id:
                    found = True
                    # Append corrected entry (last entry wins on load)
                    corrected = dict(entry)
                    for cls in corrected.get("output", {}).get("classifications", []):
                        if cls.get("task") == "LANE":
                            cls["true_label"] = final_lane
                    with open(jsonl_file, "a") as f:
                        f.write(json.dumps(corrected) + "\n")
                    break
            except (json.JSONDecodeError, KeyError):
                continue

        if found:
            break


@router.post("/train/{adapter_type}")
async def trigger_adapter_training(
    adapter_type: str,
    body: TrainRequest,
    _admin: str = Depends(get_admin_user),
):
    """
    Trigger local GLiNER2 LoRA training for a specific adapter type.
    Training data must exist in training_data/{adapter_type}.jsonl.
    """
    valid_types = ("collision", "hail", "glass_only", "tow_risk")
    if adapter_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"adapter_type must be one of {valid_types}")

    training_file = Path(__file__).parent.parent.parent / "training_data" / f"{adapter_type}.jsonl"
    if not training_file.exists() or training_file.stat().st_size == 0:
        raise HTTPException(
            status_code=422,
            detail=f"No training data found for '{adapter_type}'. Process some claims first.",
        )

    scheduler.add_job(
        _run_local_training,
        args=[adapter_type, body.model_dump()],
        id=f"local_train_{adapter_type}",
        replace_existing=True,
    )

    return {
        "message": f"Local GLiNER2 LoRA training for '{adapter_type}' queued.",
        "adapter_type": adapter_type,
    }


async def _run_local_training(adapter_type: str, params: dict) -> None:
    """
    Run local GLiNER2 LoRA training using the real training data JSONL.
    Saves adapter to ./adapters/{adapter_type}/final/
    """
    import asyncio
    import logging
    log = logging.getLogger("local_training")

    training_file = Path(__file__).parent.parent.parent / "training_data" / f"{adapter_type}.jsonl"
    if not training_file.exists() or training_file.stat().st_size == 0:
        log.warning(f"[{adapter_type}] No training data — skipping")
        return

    output_dir = Path(__file__).parent.parent.parent / "adapters" / adapter_type / "final"
    output_dir.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_event_loop()

    def _train() -> None:
        try:
            from gliner2 import GLiNER2
            from gliner2.training.trainer import GLiNER2Trainer, TrainingConfig

            # Check exact TrainingConfig fields at runtime
            try:
                config = TrainingConfig(
                    use_lora=True,
                    lora_r=8,
                    lora_alpha=16.0,
                    lora_target_modules=["encoder"],
                    save_adapter_only=True,
                    output_dir=str(output_dir.parent),
                    num_epochs=params.get("num_epochs", 10),
                    batch_size=params.get("batch_size", 8),
                    encoder_lr=params.get("learning_rate", 1e-5),
                    task_lr=params.get("learning_rate", 1e-5) * 10,
                    eval_strategy="epoch",
                    save_best=True,
                )
            except TypeError:
                # Fallback: minimal config if some params don't exist yet
                config = TrainingConfig(
                    use_lora=True,
                    output_dir=str(output_dir.parent),
                    num_epochs=params.get("num_epochs", 10),
                    batch_size=params.get("batch_size", 8),
                )

            model = GLiNER2.from_pretrained("fastino/gliner2-base-v1")
            trainer = GLiNER2Trainer(model=model, config=config)
            trainer.train(train_data=str(training_file))
            log.info(f"[{adapter_type}] Training complete. Adapter saved to {output_dir}")

        except ImportError:
            log.error(f"[{adapter_type}] gliner2 not installed or TrainingConfig unavailable")
        except Exception as exc:
            log.exception(f"[{adapter_type}] Training error: {exc}")

    await loop.run_in_executor(None, _train)
