import uuid

from fastapi import APIRouter, Depends, HTTPException

from db.neo4j_driver import get_session
from models.policy import PolicyOut
from models.vehicle import VehicleCreate, VehicleOut
from services.auth_service import get_current_user

router = APIRouter()


@router.get("/me", response_model=PolicyOut)
async def get_my_policy(user_id: str = Depends(get_current_user)):
    async with get_session() as session:
        result = await session.run(
            """
            MATCH (u:User {id: $user_id})-[:HOLDS]->(p:Policy)
            OPTIONAL MATCH (p)-[:COVERS]->(v:Vehicle)
            RETURN p, collect(v) AS vehicles
            """,
            user_id=user_id,
        )
        record = await result.single()

    if not record:
        raise HTTPException(status_code=404, detail="No policy found")

    policy = dict(record["p"])
    vehicles = [dict(v) for v in record["vehicles"] if v]
    return PolicyOut(**policy, vehicles=[VehicleOut(**v) for v in vehicles])


@router.post("/vehicles", response_model=VehicleOut, status_code=201)
async def add_vehicle(body: VehicleCreate, user_id: str = Depends(get_current_user)):
    async with get_session() as session:
        # Ensure user has a policy; create default one if not
        result = await session.run(
            "MATCH (u:User {id: $user_id})-[:HOLDS]->(p:Policy) RETURN p",
            user_id=user_id,
        )
        policy_record = await result.single()

        if not policy_record:
            policy_id = str(uuid.uuid4())
            await session.run(
                """
                MATCH (u:User {id: $user_id})
                CREATE (p:Policy {
                    id: $policy_id,
                    plan: 'basic',
                    premium_monthly: 89.99,
                    deductible: 500.0,
                    start_date: date(),
                    end_date: date() + duration('P1Y'),
                    status: 'active'
                })
                CREATE (u)-[:HOLDS]->(p)
                """,
                user_id=user_id,
                policy_id=policy_id,
            )

        # Merge vehicle (vin is unique) then link to policy
        await session.run(
            """
            MATCH (u:User {id: $user_id})-[:HOLDS]->(p:Policy)
            MERGE (v:Vehicle {vin: $vin})
            SET v.plate = $plate, v.make = $make, v.model = $model,
                v.year = $year, v.color = $color
            MERGE (p)-[:COVERS]->(v)
            """,
            user_id=user_id,
            vin=body.vin,
            plate=body.plate,
            make=body.make,
            model=body.model,
            year=body.year,
            color=body.color,
        )

    return VehicleOut(**body.model_dump())
