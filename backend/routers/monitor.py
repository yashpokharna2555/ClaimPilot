from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from services.auth_service import get_current_user
from utils.sse import stream_events

router = APIRouter()


@router.get("/{claim_id}/stream")
async def stream_claim_events(
    claim_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    SSE stream of real-time status events for a claim.
    Events: status_update, processing_complete, submission_update, error.
    """
    return EventSourceResponse(stream_events(claim_id))
