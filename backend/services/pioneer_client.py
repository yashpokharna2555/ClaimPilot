"""
Pioneer AI — async HTTP client.
Mirrors the `felix` SDK interface documented by Pioneer.

Endpoints:
  POST  /datasets/generate      → generate_data()
  POST  /training/jobs          → manage_training(action="create", ...)
  GET   /training/jobs/{job_id} → manage_training(action="get", ...)
  POST  /inference              → run_inference()

Auth: X-API-Key header.
"""
import asyncio
from typing import Any

import httpx

from config import settings


def _headers() -> dict:
    return {"X-API-Key": settings.pioneer_api_key, "Content-Type": "application/json"}


async def generate_data(
    *,
    task_type: str,
    dataset_name: str,
    domain_description: str,
    labels: list[str],
    num_examples: int = 100,
    save_to_cloud: bool = True,
) -> dict:
    """
    Create a synthetic labelled training dataset on Pioneer cloud.
    Returns: {dataset_name, num_examples, labels}
    """
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.pioneer_base_url}/datasets/generate",
            headers=_headers(),
            json={
                "task_type": task_type,
                "dataset_name": dataset_name,
                "domain_description": domain_description,
                "labels": labels,
                "num_examples": num_examples,
                "save_to_cloud": save_to_cloud,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def manage_training(action: str, **kwargs: Any) -> dict:
    """
    Create or poll a Pioneer training job.

    action="create": kwargs → model_name, datasets, base_model, num_epochs,
                              learning_rate, batch_size, validation_data_percentage
                    Returns: {job_id}

    action="get":    kwargs → job_id
                    Returns: {status, error_message?, ...}
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        if action == "create":
            resp = await client.post(
                f"{settings.pioneer_base_url}/training/jobs",
                headers=_headers(),
                json=kwargs,
            )
        elif action == "get":
            job_id = kwargs["job_id"]
            resp = await client.get(
                f"{settings.pioneer_base_url}/training/jobs/{job_id}",
                headers=_headers(),
            )
        else:
            raise ValueError(f"Unknown manage_training action: {action!r}")

        resp.raise_for_status()
        return resp.json()


async def run_inference(
    *,
    task: str,
    text: str,
    schema: list | dict,
    job_id: str,
    threshold: float = 0.5,
    include_confidence: bool = True,
) -> dict:
    """
    Run inference with a Pioneer-trained model.

    task="extract_entities": schema is a list of label strings
                             Returns: {result: {entities: {LABEL: [{text, confidence}]}}}

    task="classify_text":    schema must be {"categories": [...]}
                             Returns: {result: {category: str, confidence: float}}
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.pioneer_base_url}/inference",
            headers=_headers(),
            json={
                "task": task,
                "text": text,
                "schema": schema,
                "job_id": job_id,
                "threshold": threshold,
                "include_confidence": include_confidence,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def poll_training_until_complete(job_id: str, interval_s: int = 30) -> dict:
    """
    Async polling loop — awaits until status == 'complete' or 'errored'.
    Returns the final status dict.
    """
    while True:
        status = await manage_training(action="get", job_id=job_id)
        if status["status"] in ("complete", "errored"):
            return status
        await asyncio.sleep(interval_s)
