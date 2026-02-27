import os
import subprocess
import uuid

from fastapi import UploadFile

from config import settings


def _claim_dir(claim_id: str) -> str:
    path = os.path.join(settings.upload_dir, claim_id)
    os.makedirs(path, exist_ok=True)
    return path


async def save_video_locally(file: UploadFile, claim_id: str) -> str:
    """Save uploaded video to disk. Returns absolute file path."""
    claim_dir = _claim_dir(claim_id)
    # Preserve extension (.mp4 or .mov)
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    dest = os.path.join(claim_dir, f"raw{ext}")

    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            f.write(chunk)

    return os.path.abspath(dest)


def clip_video(video_path: str, start_s: float, end_s: float, claim_id: str, clip_type: str) -> str:
    """
    Cut a segment from video_path using ffmpeg.
    Returns absolute path to the clip file.
    """
    claim_dir = _claim_dir(claim_id)
    clip_id = str(uuid.uuid4())[:8]
    output_path = os.path.join(claim_dir, f"{clip_type.lower()}_{clip_id}.mp4")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ss", str(start_s),
        "-to", str(end_s),
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg clip failed: {result.stderr}")

    return os.path.abspath(output_path)


def extract_frame(clip_path: str, at_s: float = 1.0) -> str:
    """Extract a single keyframe from a clip. Returns absolute path to JPEG."""
    frame_path = clip_path.replace(".mp4", "_frame.jpg")
    cmd = [
        "ffmpeg", "-y",
        "-i", clip_path,
        "-ss", str(at_s),
        "-vframes", "1",
        frame_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        # Non-fatal: return None path if frame extraction fails
        return ""
    return os.path.abspath(frame_path)
