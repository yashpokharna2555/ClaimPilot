from fastapi import APIRouter, HTTPException, Query

from sse_starlette.sse import EventSourceResponse

from services.auth_service import decode_token
from utils.sse import stream_events

router = APIRouter()


@router.get("/{claim_id}/stream")
async def stream_claim_events(
    claim_id: str,
    token: str = Query(..., description="JWT access token (EventSource can't set headers)"),
):
    """
    SSE stream of real-time status events for a claim.
    Token passed as ?token= query param since browser EventSource cannot set headers.
    Events: status_update, processing_complete, submission_update, error.
    """
    try:
        decode_token(token, expected_type="access")
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return EventSourceResponse(stream_events(claim_id))
