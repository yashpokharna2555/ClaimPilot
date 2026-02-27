import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from neo4j import AsyncGraphDatabase, AsyncDriver, AsyncSession, NotificationDisabledClassification

from config import settings

_driver: AsyncDriver | None = None

# Suppress noisy "relationship type does not exist" warnings on fresh databases
logging.getLogger("neo4j").setLevel(logging.ERROR)


async def connect() -> None:
    global _driver
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
        notifications_disabled_classifications={
            NotificationDisabledClassification.UNRECOGNIZED,
            NotificationDisabledClassification.SCHEMA,
        },
    )
    await _driver.verify_connectivity()


async def disconnect() -> None:
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


def get_driver() -> AsyncDriver:
    if _driver is None:
        raise RuntimeError("Neo4j driver not initialized. Call connect() first.")
    return _driver


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_driver().session() as session:
        yield session
