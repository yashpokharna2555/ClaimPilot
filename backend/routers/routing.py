import json

from fastapi import APIRouter, Depends, HTTPException

from db.neo4j_driver import get_session
from models.claim_json import RoutingDecision
from services.auth_service import get_current_user

router = APIRouter()


@router.get("/{claim_id}/routing", response_model=RoutingDecision)
async def get_routing(claim_id: str, user_id: str = Depends(get_current_user)):
    """Return the routing decision for a completed claim."""
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim {id: $claim_id})
            OPTIONAL MATCH (c)-[:PRODUCED]->(cd:ClaimData)
            RETURN c.lane AS lane, c.coverage_score AS coverage_score,
                   c.fraud_risk AS fraud_risk, c.status AS status,
                   cd.routing_json AS routing_json
            """,
            user_id=user_id,
            claim_id=claim_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="Claim not found")

    if record["status"] in ("pending", "processing"):
        raise HTTPException(status_code=202, detail="Claim is still being processed")

    if record["routing_json"]:
        try:
            return RoutingDecision(**json.loads(record["routing_json"]))
        except Exception:
            pass

    # Fallback from top-level Claim node fields
    return RoutingDecision(
        lane=record["lane"] or "HUMAN_ADJUSTER",
        coverage_score=record["coverage_score"] or 0,
        fraud_risk=record["fraud_risk"] or "low",
    )
