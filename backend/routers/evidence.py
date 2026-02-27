from fastapi import APIRouter, Depends, HTTPException

from db.neo4j_driver import get_session
from models.evidence import Clip, EvidenceBundle, Tag
from services.auth_service import get_current_user

router = APIRouter()


@router.get("/{claim_id}/evidence", response_model=EvidenceBundle)
async def get_evidence(claim_id: str, user_id: str = Depends(get_current_user)):
    """Return the full EvidenceBundle for a claim."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim {id: $claim_id})
            OPTIONAL MATCH (c)-[:HAS_EVIDENCE]->(e:EvidenceAsset)
            RETURN c.session_id AS session_id, collect(e) AS evidence
            """,
            user_id=user_id,
            claim_id=claim_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="Claim not found")

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
        for e in record["evidence"]
        if e
    ]

    return EvidenceBundle(
        session_id=record["session_id"] or claim_id,
        video_id=claim_id,
        tags=[],  # Tags returned from ClaimData; evidence endpoint focuses on clips
        clips=clips,
    )
