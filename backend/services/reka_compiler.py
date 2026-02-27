"""
Reka Vision API integration.
Docs: https://docs.reka.ai/
SDK:  pip install reka-api>=3.2.0
"""
import asyncio
import json
import uuid
from pathlib import Path

import httpx

from config import settings
from models.evidence import Clip, EvidenceBundle, Tag

REKA_BASE = "https://vision-agent.api.reka.ai/v1"
HEADERS = {"X-Api-Key": settings.reka_api_key, "Content-Type": "application/json"}

# Shot type → natural language search query for Reka video search
SHOT_QUERIES: dict[str, str] = {
    "VIN": "VIN plate door jamb sticker close-up",
    "PLATE": "license plate close-up",
    "DASH": "dashboard warning lights interior",
    "DAMAGE": "vehicle collision damage dent crumple deformation broken panel front rear side impact",
    "WHEEL": "wheel tire underbody angle",
    "WIDE": "full vehicle wide shot exterior",
    "OTHER_PARTY": "other vehicle license plate",
}

# Confidence threshold for Reka search results (relative score)
SEARCH_THRESHOLD = 0.5

# Prompt for damage-focused highlight clips
_CLIPS_PROMPT = (
    "Generate highlight clips showing all visible vehicle damage for an insurance claim. "
    "Focus on: front collision impact zones, crumple damage, airbag deployment indicators, "
    "dashboard warning lights, fluid leaks, broken glass, wheel/tire damage, "
    "and structural deformation. Each clip should clearly show a specific damage area. "
    "Prioritize angles where damage severity is unambiguous."
)


async def index_video_url(video_url: str) -> str:
    """
    Index a video URL with Reka (no local file needed).
    Returns video_id for use with search + Q&A.
    """
    video_name = f"claim_{uuid.uuid4().hex[:8]}"
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{REKA_BASE}/videos/upload",
            headers={"X-Api-Key": settings.reka_api_key},
            json={"url": video_url, "index": True, "video_name": video_name},
        )
        response.raise_for_status()
        return response.json()["video_id"]


async def wait_for_indexing(video_id: str, timeout_s: int = 300) -> None:
    """Poll until Reka video is fully indexed."""
    async with httpx.AsyncClient(timeout=30) as client:
        deadline = asyncio.get_event_loop().time() + timeout_s
        while asyncio.get_event_loop().time() < deadline:
            resp = await client.get(
                f"{REKA_BASE}/videos/{video_id}",
                headers={"X-Api-Key": settings.reka_api_key},
            )
            resp.raise_for_status()
            status = resp.json().get("indexing_status")
            if status == "indexed":
                return
            if status == "failed":
                raise RuntimeError(f"Reka indexing failed for video {video_id}")
            await asyncio.sleep(10)
    raise TimeoutError(f"Reka indexing timed out after {timeout_s}s")


async def search_shot_type(video_id: str, clip_type: str, query: str) -> list[dict]:
    """Search for a specific shot type in the video. Returns matched segments."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{REKA_BASE}/search",
            headers={"X-Api-Key": settings.reka_api_key},
            json={
                "query": query,
                "video_ids": [video_id],
                "threshold": SEARCH_THRESHOLD,
                "max_results": 3,
            },
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])

    segments = []
    for r in results:
        segments.append({
            "clip_type": clip_type,
            "start_s": r.get("start_timestamp", 0.0),
            "end_s": r.get("end_timestamp", 0.0),
            "confidence": r.get("score", 0.5),
            "explanation": r.get("explanation", ""),
        })
    return segments


async def search_shot_types(video_id: str) -> list[dict]:
    """Run all shot type searches in parallel. Returns list of segment dicts."""
    tasks = [
        search_shot_type(video_id, clip_type, query)
        for clip_type, query in SHOT_QUERIES.items()
    ]
    results_per_type = await asyncio.gather(*tasks, return_exceptions=True)

    all_segments = []
    for clip_type, result in zip(SHOT_QUERIES.keys(), results_per_type):
        if isinstance(result, Exception):
            continue  # Skip failed searches
        all_segments.extend(result)

    return all_segments


async def analyze_damage(video_id: str) -> str:
    """
    Use Reka Q&A to get a natural language damage analysis.
    This text becomes the input to GLiNER2.
    """
    prompt = (
        "Analyze this vehicle damage video. List every visible damage area. "
        "For each: (1) exact location on vehicle, (2) damage type (dent, crack, scrape, broken glass, etc.), "
        "(3) severity (low, moderate, high). "
        "Also note: airbag deployment status, dashboard warning lights, any fluid leaks under vehicle, "
        "wheel or tire misalignment, glass damage. "
        "Note if VIN plate, license plate, or odometer are visible. "
        "Describe capture quality (lighting, blur, camera stability)."
    )
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{REKA_BASE}/qa/chat",
            headers={"X-Api-Key": settings.reka_api_key},
            json={
                "video_id": video_id,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json().get("chat_response", "")


async def get_video_tags(video_id: str) -> dict:
    """Get indexed tags (description, keywords) from Reka."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{REKA_BASE}/qa/indexedtag",
            headers={"X-Api-Key": settings.reka_api_key},
            json={"video_id": video_id},
        )
        resp.raise_for_status()
        return resp.json()


async def generate_highlight_clips(video_url: str, claim_id: str) -> list[dict]:
    """
    Generate damage-focused highlight clips via Reka /v1/clips (submit-and-poll).
    Falls back to /creator/reels if /clips returns 404.
    Returns list of clip dicts with clip_url and caption.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        # Submit the clip generation job
        resp = await client.post(
            f"{REKA_BASE}/clips",
            headers={"X-Api-Key": settings.reka_api_key},
            json={
                "video_urls": [video_url],
                "prompt": _CLIPS_PROMPT,
                "generation_config": {
                    "num_generations": 5,
                    "min_duration_seconds": 3,
                    "max_duration_seconds": 20,
                },
            },
        )

        if resp.status_code == 404:
            # Fallback to /creator/reels single-call endpoint
            return await _generate_clips_via_reels(video_url, claim_id)

        resp.raise_for_status()
        job_data = resp.json()
        job_id = job_data.get("job_id") or job_data.get("id")

    if not job_id:
        return []

    # Poll until completed
    clips_data = await _poll_clips_job(job_id)
    return _map_clips_output(clips_data, claim_id)


async def _poll_clips_job(job_id: str, timeout_s: int = 300) -> list[dict]:
    """Poll GET /clips/{job_id} until status == 'completed'. Returns output list."""
    async with httpx.AsyncClient(timeout=30) as client:
        deadline = asyncio.get_event_loop().time() + timeout_s
        while asyncio.get_event_loop().time() < deadline:
            resp = await client.get(
                f"{REKA_BASE}/clips/{job_id}",
                headers={"X-Api-Key": settings.reka_api_key},
            )
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status")
            if status == "completed":
                return data.get("output", [])
            if status == "failed":
                return []
            await asyncio.sleep(5)
    return []


def _map_clips_output(outputs: list[dict], claim_id: str) -> list[dict]:
    """Map Reka clips output to our internal clip dict format."""
    clips = []
    damage_types = ["DAMAGE", "WIDE", "DASH", "WHEEL", "OTHER_PARTY"]
    for i, item in enumerate(outputs):
        clip_type = damage_types[i % len(damage_types)]
        clips.append({
            "clip_type": clip_type,
            "clip_id": f"{claim_id[:8]}_{clip_type.lower()}_{i}",
            "clip_url": item.get("video_url") or item.get("url") or "",
            "caption": item.get("caption") or item.get("description") or "",
            "start_s": 0.0,
            "end_s": 0.0,
            "confidence": item.get("engagement_score") or item.get("score") or 0.8,
        })
    return clips


async def _generate_clips_via_reels(video_url: str, claim_id: str) -> list[dict]:
    """Fallback: use /creator/reels endpoint when /clips is unavailable."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{REKA_BASE}/creator/reels",
            headers={"X-Api-Key": settings.reka_api_key},
            json={
                "video_urls": [video_url],
                "prompt": _CLIPS_PROMPT,
                "generation_config": {
                    "num_generations": 5,
                    "min_duration_seconds": 3,
                    "max_duration_seconds": 20,
                },
            },
        )
        if not resp.is_success:
            return []
        data = resp.json()

    outputs = data.get("output", [])
    return _map_clips_output(outputs, claim_id)


async def store_evidence_nodes(session, claim_id: str, clips: list[dict]) -> None:
    """Create EvidenceAsset nodes in Neo4j and link to Claim."""
    for clip in clips:
        await session.run(
            """
            MATCH (c:Claim {id: $claim_id})
            CREATE (e:EvidenceAsset {
                clip_id: $clip_id,
                clip_type: $clip_type,
                clip_url: $clip_url,
                caption: $caption,
                start_s: $start_s,
                end_s: $end_s,
                confidence: $confidence
            })
            CREATE (c)-[:HAS_EVIDENCE]->(e)
            """,
            claim_id=claim_id,
            clip_id=clip["clip_id"],
            clip_type=clip["clip_type"],
            clip_url=clip.get("clip_url", ""),
            caption=clip.get("caption", ""),
            start_s=clip["start_s"],
            end_s=clip["end_s"],
            confidence=clip["confidence"],
        )


async def extract_claim_metadata(video_id: str) -> dict:
    """
    Single Reka QA call that returns a structured JSON dict with all incident metadata.
    Falls back gracefully if the response is malformed.
    """
    import json as _json
    import re

    prompt = (
        'Analyze this vehicle incident/damage video. Return ONLY a JSON object:\n'
        '{\n'
        '  "incident_type": "<rear_end|front_impact|side_impact|hail|glass_only|flood|vandalism|other>",\n'
        '  "vin": "<17-char VIN if clearly visible, else null>",\n'
        '  "license_plate": "<plate number if visible, else null>",\n'
        '  "vehicle_make": "<make if identifiable, else null>",\n'
        '  "vehicle_model": "<model if identifiable, else null>",\n'
        '  "vehicle_year": "<4-digit year if identifiable, else null>",\n'
        '  "incident_location": "<any visible street signs, intersections, landmarks, else null>",\n'
        '  "damage_summary": "<2-3 sentence description of all visible damage>",\n'
        '  "is_dashcam": <true if dashcam footage of collision, false if post-incident walkaround>\n'
        '}'
    )

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{REKA_BASE}/qa/chat",
            headers={"X-Api-Key": settings.reka_api_key},
            json={
                "video_id": video_id,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
        )
        resp.raise_for_status()
        raw = resp.json().get("chat_response", "")

    # Strip any prose wrapping around the JSON block
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        try:
            return _json.loads(json_match.group())
        except _json.JSONDecodeError:
            pass

    # Fallback: return safe defaults
    return {
        "incident_type": "other",
        "vin": None,
        "license_plate": None,
        "vehicle_make": None,
        "vehicle_model": None,
        "vehicle_year": None,
        "incident_location": None,
        "damage_summary": raw[:500] if raw else "",
        "is_dashcam": False,
    }


def build_evidence_bundle(
    session_id: str,
    video_id: str,
    tags_data: dict,
    clips: list[dict],
) -> EvidenceBundle:
    """Construct EvidenceBundle Pydantic model from Reka outputs."""
    keywords = tags_data.get("keywords", [])
    tags = [Tag(tag=kw, confidence=0.8) for kw in keywords[:20]]

    bundle_clips = [
        Clip(
            clip_type=c["clip_type"],
            clip_id=c["clip_id"],
            clip_url=c.get("clip_url", ""),
            caption=c.get("caption", ""),
            start_s=c["start_s"],
            end_s=c["end_s"],
            confidence=c["confidence"],
        )
        for c in clips
    ]

    return EvidenceBundle(
        session_id=session_id,
        video_id=video_id,
        tags=tags,
        clips=bundle_clips,
    )


def log_extraction_results(
    claim_id: str,
    metadata: dict,
    segments: list[dict],
    damage_analysis: str,
    clips: list[dict],
    claim_json: dict,
    tags_data: dict,
) -> None:
    """Write full structured extraction output to ./logs/{claim_id}_extraction.json."""
    logs_dir = Path(__file__).parent.parent.parent / "logs"
    logs_dir.mkdir(exist_ok=True)

    log_data = {
        "claim_id": claim_id,
        "reka_metadata": metadata,
        "reka_segments": segments,
        "reka_damage_analysis": damage_analysis,
        "reka_tags": tags_data,
        "clips": clips,
        "claim_json": claim_json,
    }

    log_path = logs_dir / f"{claim_id}_extraction.json"
    with open(log_path, "w") as f:
        json.dump(log_data, f, indent=2, default=str)
