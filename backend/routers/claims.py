import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from db.neo4j_driver import get_session
from models.claim import ClaimDetail, ClaimOut
from models.claim_json import ClaimJSON
from services.auth_service import get_current_user
from services import ingestion
from tasks.scheduler import enqueue_process_video

router = APIRouter()


class NewClaimRequest(BaseModel):
    video_url: str
    incident_date: str | None = None
    description: str | None = None


@router.post("/new", response_model=dict, status_code=status.HTTP_201_CREATED)
async def file_claim(
    body: NewClaimRequest,
    user_id: str = Depends(get_current_user),
):
    """Accept YouTube/video URL. Returns claim_id immediately; pipeline runs async."""
    async with get_session() as session:
        claim_id = await ingestion.create_claim_node(
            session,
            user_id=user_id,
            video_url=body.video_url,
            incident_date=body.incident_date,
            description=body.description,
        )

    enqueue_process_video(claim_id, user_id)

    return {"claim_id": claim_id, "status": "pending"}


@router.get("", response_model=list[ClaimOut])
async def list_claims(user_id: str = Depends(get_current_user)):
    """List all claims filed by the current user."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim)
            RETURN c ORDER BY c.filed_at DESC
            """,
            user_id=user_id,
        )
        records = await result.data()

    return [
        ClaimOut(
            id=r["c"]["id"],
            session_id=r["c"]["session_id"],
            status=r["c"]["status"],
            incident_type=r["c"]["incident_type"],
            filed_at=str(r["c"]["filed_at"]),
            lane=r["c"].get("lane"),
            coverage_score=r["c"].get("coverage_score"),
            fraud_risk=r["c"].get("fraud_risk"),
        )
        for r in records
    ]


@router.get("/{claim_id}/log")
async def get_claim_log(claim_id: str, user_id: str = Depends(get_current_user)):
    """Return the full extraction log for a claim as JSON."""
    log_path = Path(__file__).parent.parent.parent / "logs" / f"{claim_id}_extraction.json"
    if not log_path.exists():
        raise HTTPException(status_code=404, detail="Log not found — processing may still be in progress")
    with open(log_path) as f:
        return json.load(f)


@router.get("/{claim_id}", response_model=ClaimDetail)
async def get_claim(claim_id: str, user_id: str = Depends(get_current_user)):
    """Get full claim detail including ClaimJSON and EvidenceBundle."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim {id: $claim_id})
            OPTIONAL MATCH (c)-[:FOR]->(v:Vehicle)
            OPTIONAL MATCH (c)-[:PRODUCED]->(cd:ClaimData)
            OPTIONAL MATCH (c)-[:HAS_EVIDENCE]->(e:EvidenceAsset)
            RETURN c, v, cd, collect(e) AS evidence
            """,
            user_id=user_id,
            claim_id=claim_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="Claim not found")

    c = record["c"]
    v = record["v"]
    cd = record["cd"]
    evidence_assets = record["evidence"]

    claim_json = None
    if cd:
        try:
            from models.claim_json import VehicleIdentity, DamageMap, HazardDrivability, SubmissionPack, RoutingDecision
            claim_json = ClaimJSON(
                vehicle_identity=VehicleIdentity(**json.loads(cd.get("vehicle_json", "{}"))),
                damage_map=DamageMap(**json.loads(cd.get("incident_json", "{}"))),
                hazards=HazardDrivability(**json.loads(cd.get("incident_json", "{}"))),
                submission_pack=SubmissionPack(**json.loads(cd.get("evidence_json", "{}"))),
                routing=RoutingDecision(**json.loads(cd.get("routing_json", "{}"))),
            )
        except Exception:
            claim_json = None

    return ClaimDetail(
        id=c["id"],
        session_id=c["session_id"],
        status=c["status"],
        incident_type=c["incident_type"],
        filed_at=str(c["filed_at"]),
        lane=c.get("lane"),
        coverage_score=c.get("coverage_score"),
        fraud_risk=c.get("fraud_risk"),
        vin=v["vin"] if v else None,
        claim_json=claim_json,
    )
