import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.neo4j_driver import connect, disconnect
from db.constraints import apply_constraints_and_indexes
from tasks.scheduler import scheduler, start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — create logs directory for extraction debug output
    os.makedirs("logs", exist_ok=True)

    await connect()
    await apply_constraints_and_indexes()

    # Load GLiNER2 model once (cached in ~/.cache/huggingface after first download)
    from services.fastino_brain import load_model
    load_model()

    start_scheduler()

    yield

    # Shutdown
    stop_scheduler()
    await disconnect()


app = FastAPI(
    title="SwiftSettle API",
    description="Vehicle insurance claims automation platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — imported after app creation to avoid circular imports
from routers import auth, policy, claims, evidence, routing, submission, monitor, admin  # noqa: E402

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(policy.router, prefix="/policy", tags=["policy"])
app.include_router(claims.router, prefix="/claims", tags=["claims"])
app.include_router(evidence.router, prefix="/claims", tags=["evidence"])
app.include_router(routing.router, prefix="/claims", tags=["routing"])
app.include_router(submission.router, prefix="/claims", tags=["submission"])
app.include_router(monitor.router, prefix="/claims", tags=["monitor"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/detailed")
async def health_detailed():
    """Detailed health check including scheduler status."""
    from tasks.scheduler import scheduler
    jobs = [{"id": j.id, "next_run": str(j.next_run_time)} for j in scheduler.get_jobs()]
    return {"status": "ok", "scheduled_jobs": jobs}
