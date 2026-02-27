from pydantic import BaseModel


class Tag(BaseModel):
    tag: str
    confidence: float


class Clip(BaseModel):
    clip_type: str
    clip_id: str
    clip_url: str        # Reka-hosted URL from /v1/clips
    start_s: float
    end_s: float
    confidence: float
    caption: str = ""    # AI caption from Reka output


class EvidenceBundle(BaseModel):
    session_id: str
    video_id: str
    tags: list[Tag]
    clips: list[Clip]
