import asyncio
import json
from collections.abc import AsyncGenerator

# claim_id → asyncio.Queue
_queues: dict[str, asyncio.Queue] = {}


def get_or_create_queue(claim_id: str) -> asyncio.Queue:
    if claim_id not in _queues:
        _queues[claim_id] = asyncio.Queue(maxsize=100)
    return _queues[claim_id]


async def push_event(claim_id: str, event_type: str, data: dict) -> None:
    queue = get_or_create_queue(claim_id)
    payload = {"type": event_type, **data}
    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        pass  # Drop if buffer full


async def stream_events(claim_id: str) -> AsyncGenerator[dict, None]:
    queue = get_or_create_queue(claim_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield {"data": json.dumps(event), "event": event.get("type", "update")}
            except asyncio.TimeoutError:
                # Send keepalive ping so connection stays open
                yield {"data": "ping", "event": "ping"}
    finally:
        # Cleanup queue if empty after stream ends
        if claim_id in _queues and _queues[claim_id].empty():
            _queues.pop(claim_id, None)
