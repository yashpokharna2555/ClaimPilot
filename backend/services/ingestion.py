import uuid
from datetime import date

from neo4j import AsyncSession


async def create_claim_node(
    session: AsyncSession,
    user_id: str,
    video_url: str,
    incident_date: str | None = None,
    description: str | None = None,
) -> str:
    """Create a Claim node without requiring VIN or vehicle upfront.

    Vehicle linking is deferred to the scheduler after Reka extracts the VIN.
    """
    claim_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    resolved_date = incident_date or date.today().isoformat()

    await session.run(
        """
        MATCH (u:User {id: $user_id})
        CREATE (c:Claim {
            id: $claim_id,
            session_id: $session_id,
            status: 'pending',
            incident_type: 'pending',
            incident_date: $incident_date,
            incident_location: null,
            description: $description,
            video_url: $video_url,
            filed_at: datetime(),
            lane: null,
            coverage_score: null,
            fraud_risk: null
        })
        CREATE (u)-[:FILED]->(c)
        """,
        user_id=user_id,
        claim_id=claim_id,
        session_id=session_id,
        incident_date=resolved_date,
        description=description or "",
        video_url=video_url,
    )
    return claim_id


async def link_vehicle_to_claim(
    session: AsyncSession,
    claim_id: str,
    user_id: str,
    vin: str | None,
    make: str | None,
    model: str | None,
    year: str | None,
    license_plate: str | None,
) -> bool:
    """Try to link the Claim to a Vehicle node.

    1. If vin is provided, try to match a vehicle on the user's policy.
    2. If no policy match, MERGE a Vehicle node with the extracted attributes.
    3. Returns True if a vehicle was linked, False otherwise.
    """
    if vin:
        # Try to match existing policy vehicle
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:HOLDS]->(:Policy)-[:COVERS]->(v:Vehicle {vin: $vin})
            MATCH (c:Claim {id: $claim_id})
            MERGE (c)-[:FOR]->(v)
            RETURN v
            """,
            user_id=user_id,
            claim_id=claim_id,
            vin=vin,
        )
        record = await result.single()
        if record:
            return True

        # VIN found in video but not on policy — MERGE a new Vehicle node
        await session.run(
            """
            MERGE (v:Vehicle {vin: $vin})
            ON CREATE SET
                v.make = $make,
                v.model = $model,
                v.year = $year,
                v.license_plate = $license_plate
            WITH v
            MATCH (c:Claim {id: $claim_id})
            MERGE (c)-[:FOR]->(v)
            """,
            claim_id=claim_id,
            vin=vin,
            make=make or "",
            model=model or "",
            year=year or "",
            license_plate=license_plate or "",
        )
        return True

    # No VIN extracted — leave claim unlinked, handled by routing as HUMAN_ADJUSTER
    return False


async def update_claim_metadata(
    session: AsyncSession,
    claim_id: str,
    incident_type: str,
    incident_location: str | None,
    description: str | None,
) -> None:
    """Update Claim node with metadata extracted by Reka QA."""
    await session.run(
        """
        MATCH (c:Claim {id: $claim_id})
        SET c.incident_type = $incident_type,
            c.incident_location = $incident_location
        """,
        claim_id=claim_id,
        incident_type=incident_type,
        incident_location=incident_location or "",
    )
    # Only overwrite description if the user left it blank
    if description:
        await session.run(
            """
            MATCH (c:Claim {id: $claim_id})
            WHERE c.description = '' OR c.description IS NULL
            SET c.description = $description
            """,
            claim_id=claim_id,
            description=description,
        )


async def update_claim_status(session: AsyncSession, claim_id: str, status: str) -> None:
    await session.run(
        "MATCH (c:Claim {id: $claim_id}) SET c.status = $status",
        claim_id=claim_id,
        status=status,
    )


async def update_claim_result(
    session: AsyncSession,
    claim_id: str,
    lane: str,
    coverage_score: int,
    fraud_risk: str,
) -> None:
    await session.run(
        """
        MATCH (c:Claim {id: $claim_id})
        SET c.status = 'complete',
            c.lane = $lane,
            c.coverage_score = $coverage_score,
            c.fraud_risk = $fraud_risk
        """,
        claim_id=claim_id,
        lane=lane,
        coverage_score=coverage_score,
        fraud_risk=fraud_risk,
    )
