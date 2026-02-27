"""
Run on application startup to ensure all Neo4j constraints and indexes exist.
"""
from db.neo4j_driver import get_session

CONSTRAINTS = [
    "CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE",
    "CREATE CONSTRAINT vehicle_vin IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.vin IS UNIQUE",
    "CREATE CONSTRAINT claim_id IF NOT EXISTS FOR (c:Claim) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT policy_id IF NOT EXISTS FOR (p:Policy) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT submission_id IF NOT EXISTS FOR (s:Submission) REQUIRE s.id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX claim_session IF NOT EXISTS FOR (c:Claim) ON (c.session_id)",
    "CREATE INDEX claim_status IF NOT EXISTS FOR (c:Claim) ON (c.status)",
    "CREATE INDEX claim_filed_at IF NOT EXISTS FOR (c:Claim) ON (c.filed_at)",
    "CREATE INDEX user_id IF NOT EXISTS FOR (u:User) ON (u.id)",
]


async def apply_constraints_and_indexes() -> None:
    async with get_session() as session:
        for stmt in CONSTRAINTS + INDEXES:
            await session.run(stmt)
