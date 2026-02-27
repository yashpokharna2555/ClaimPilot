"""
GLiNER2 underwriting brain.
Model: fastino/gliner2-base-v1 (205M params, CPU-optimized).
Docs: https://github.com/fastino-ai/GLiNER2
SDK:  pip install gliner2
"""
import json
import os
from pathlib import Path

from config import settings
from models.claim_json import (
    ClaimJSON,
    DamageMap,
    HazardDrivability,
    RoutingDecision,
    SubmissionPack,
    VehicleIdentity,
)
from models.evidence import EvidenceBundle

# GLiNER2 model — loaded once at startup
_extractor = None

# --- Label groups for the four structured contracts ---

VEHICLE_IDENTITY_LABELS = [
    "vin_visible",
    "plate_visible",
    "make_model_guess",
    "odometer_visible",
]

DAMAGE_MAP_LABELS = [
    "damage_zone",
    "damage_type",
    "severity",
]

HAZARD_LABELS = [
    "airbag_deployed",
    "fluid_leak_suspected",
    "wheel_misalignment_suspected",
    "warning_lights_present",
    "glass_damage",
]

SUBMISSION_PACK_LABELS = [
    "required_field_present",
    "missing_field",
    "recommended_next_capture",
]

LANE_CLASSES = {"LANE": ["SHOP_ESTIMATE", "TOW_REQUIRED", "HUMAN_ADJUSTER", "FRAUD_REVIEW"]}
DRIVABLE_CLASSES = {"DRIVABLE": ["YES", "NO", "UNKNOWN"]}

# Adapter directory (relative to project root)
ADAPTERS_DIR = Path(__file__).parent.parent.parent / "adapters"


def load_model() -> None:
    """Load GLiNER2 base model at app startup. Cached in ~/.cache/huggingface."""
    global _extractor
    from gliner2 import GLiNER2
    _extractor = GLiNER2.from_pretrained("fastino/gliner2-base-v1")


def _get_extractor():
    if _extractor is None:
        load_model()
    return _extractor


def build_gliner_input(bundle: EvidenceBundle, damage_analysis: str) -> str:
    """
    Serialize Reka outputs into normalized text lines for GLiNER2.
    GLiNER2 receives structured text — NOT raw video.
    """
    lines = []

    for tag in bundle.tags[:20]:
        lines.append(f"tag: {tag.tag} ({tag.confidence:.2f})")

    for clip in bundle.clips:
        lines.append(f"clip: {clip.clip_type} (present, t={clip.start_s:.1f}-{clip.end_s:.1f}s)")

    if damage_analysis:
        lines.append(f"analysis: {damage_analysis}")

    return "\n".join(lines)


def select_adapter(bundle: EvidenceBundle) -> str | None:
    """
    Choose which LoRA adapter to load based on evidence signals.
    Returns adapter path string or None (use base model).
    """
    tag_names = {t.tag.lower() for t in bundle.tags}
    clip_types = {c.clip_type.upper() for c in bundle.clips}

    def adapter_exists(name: str) -> bool:
        return (ADAPTERS_DIR / name / "final").exists()

    if "hail" in tag_names and adapter_exists("hail"):
        return str(ADAPTERS_DIR / "hail" / "final")

    if "glass_damage" in tag_names and not any("DAMAGE" in ct for ct in clip_types):
        if adapter_exists("glass_only"):
            return str(ADAPTERS_DIR / "glass_only" / "final")

    if any(t in tag_names for t in ("fluid_leak", "fluid_under_vehicle", "wheel_damage")):
        if adapter_exists("tow_risk"):
            return str(ADAPTERS_DIR / "tow_risk" / "final")

    if adapter_exists("collision"):
        return str(ADAPTERS_DIR / "collision" / "final")

    return None  # Fall back to base model


def run_four_contract_extraction(text: str, adapter_path: str | None) -> dict:
    """
    Single logical pass: run four entity extraction calls + two classifications.
    All use the same loaded model (optionally with a LoRA adapter).
    Returns a dict with keys: vehicle_identity, damage_map, hazards, submission_pack, lane, drivable.
    """
    ext = _get_extractor()

    if adapter_path:
        try:
            ext.load_adapter(adapter_path)
        except Exception:
            pass  # Fall back to base model if adapter load fails

    vehicle_identity = ext.extract_entities(text, VEHICLE_IDENTITY_LABELS, include_confidence=True)
    damage_map = ext.extract_entities(text, DAMAGE_MAP_LABELS, include_confidence=True)
    hazards = ext.extract_entities(text, HAZARD_LABELS, include_confidence=True)
    submission_pack = ext.extract_entities(text, SUBMISSION_PACK_LABELS, include_confidence=True)

    lane_result = ext.classify_text(text, LANE_CLASSES)
    drivable_result = ext.classify_text(text, DRIVABLE_CLASSES)

    return {
        "vehicle_identity": vehicle_identity.get("entities", {}),
        "damage_map": damage_map.get("entities", {}),
        "hazards": hazards.get("entities", {}),
        "submission_pack": submission_pack.get("entities", {}),
        "lane": lane_result.get("LANE", "HUMAN_ADJUSTER"),
        "drivable": drivable_result.get("DRIVABLE", "UNKNOWN"),
    }


def _entity_texts(entities: dict, label: str) -> list[str]:
    """Extract text values for a given entity label."""
    items = entities.get(label, [])
    if isinstance(items, list):
        return [item["text"] if isinstance(item, dict) else str(item) for item in items]
    return []


def _entity_present(entities: dict, label: str) -> bool:
    """Check if a boolean-like entity label was extracted."""
    return bool(entities.get(label))


def parse_claim_json(raw: dict, bundle: EvidenceBundle) -> ClaimJSON:
    """Map four GLiNER2 contract dicts + classifications → ClaimJSON Pydantic model."""
    vi = raw["vehicle_identity"]
    dm = raw["damage_map"]
    hz = raw["hazards"]
    sp = raw["submission_pack"]

    # Determine severity from extracted values (pick highest if multiple)
    severity_values = _entity_texts(dm, "severity")
    severity_priority = {"high": 3, "moderate": 2, "low": 1, "unknown": 0}
    severity = max(severity_values, key=lambda s: severity_priority.get(s.lower(), 0), default="unknown")

    vehicle_identity = VehicleIdentity(
        vin_visible=_entity_present(vi, "vin_visible"),
        plate_visible=_entity_present(vi, "plate_visible"),
        make_model_guess=(_entity_texts(vi, "make_model_guess") or [None])[0],
        odometer_visible=_entity_present(vi, "odometer_visible"),
    )

    damage_map = DamageMap(
        damage_zones=_entity_texts(dm, "damage_zone"),
        damage_types=_entity_texts(dm, "damage_type"),
        severity=severity if severity else "unknown",
    )

    hazards = HazardDrivability(
        airbag_deployed=_entity_present(hz, "airbag_deployed"),
        fluid_leak_suspected=_entity_present(hz, "fluid_leak_suspected"),
        wheel_misalignment_suspected=_entity_present(hz, "wheel_misalignment_suspected"),
        warning_lights_present=_entity_present(hz, "warning_lights_present"),
        glass_damage=_entity_present(hz, "glass_damage"),
        drivable=raw["drivable"].lower(),
    )

    submission_pack = SubmissionPack(
        required_fields_present=_entity_texts(sp, "required_field_present"),
        missing_fields=_entity_texts(sp, "missing_field"),
        recommended_next_capture=(_entity_texts(sp, "recommended_next_capture") or [None])[0],
    )

    # Routing is computed by policy_engine; placeholder here
    routing = RoutingDecision(
        lane=raw["lane"],
        coverage_score=0,
        fraud_risk="low",
    )

    return ClaimJSON(
        vehicle_identity=vehicle_identity,
        damage_map=damage_map,
        hazards=hazards,
        submission_pack=submission_pack,
        routing=routing,
    )


async def store_claim_data(session, claim_id: str, claim_json: ClaimJSON) -> None:
    """Create ClaimData node in Neo4j and link to Claim."""
    await session.run(
        """
        MATCH (c:Claim {id: $claim_id})
        CREATE (cd:ClaimData {
            incident_json: $incident_json,
            vehicle_json: $vehicle_json,
            evidence_json: $evidence_json,
            routing_json: $routing_json
        })
        CREATE (c)-[:PRODUCED]->(cd)
        """,
        claim_id=claim_id,
        incident_json=claim_json.hazards.model_dump_json(),
        vehicle_json=claim_json.vehicle_identity.model_dump_json(),
        evidence_json=claim_json.submission_pack.model_dump_json(),
        routing_json=claim_json.routing.model_dump_json(),
    )


def _flatten_entities(raw_output: dict) -> dict:
    """
    Flatten four contract entity dicts into a single flat dict of {label: [text, ...]}.
    Extracts only text strings, dropping confidence scores.
    """
    flat: dict[str, list[str]] = {}
    for group_key in ("vehicle_identity", "damage_map", "hazards", "submission_pack"):
        group = raw_output.get(group_key, {})
        for label, items in group.items():
            texts: list[str] = []
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        texts.append(item.get("text", str(item)))
                    else:
                        texts.append(str(item))
            elif isinstance(items, str):
                texts = [items]
            if texts:
                flat[label] = texts
    return flat


def save_training_example(
    gliner_input: str,
    raw_output: dict,
    claim_id: str,
    adapter_type: str = "collision",
) -> None:
    """
    Append a JSONL training example in GLiNER2-compatible flat format.
    Called after every successful claim processing.
    """
    training_dir = Path(__file__).parent.parent.parent / "training_data"
    training_dir.mkdir(exist_ok=True)
    file_path = training_dir / f"{adapter_type}.jsonl"

    flat_entities = _flatten_entities(raw_output)

    example = {
        "claim_id": claim_id,  # kept for lookup/correction dedup
        "input": gliner_input,
        "output": {
            "entities": flat_entities,
            "classifications": [
                {
                    "task": "LANE",
                    "labels": ["SHOP_ESTIMATE", "TOW_REQUIRED", "HUMAN_ADJUSTER", "FRAUD_REVIEW"],
                    "true_label": raw_output.get("lane", "HUMAN_ADJUSTER"),
                },
                {
                    "task": "DRIVABLE",
                    "labels": ["YES", "NO", "UNKNOWN"],
                    "true_label": (raw_output.get("drivable") or "UNKNOWN").upper(),
                },
            ],
        },
    }

    with open(file_path, "a") as f:
        f.write(json.dumps(example) + "\n")

    # Auto-trigger retraining every 10 new examples
    try:
        line_count = sum(1 for _ in open(file_path))
        if line_count % 10 == 0:
            from tasks.scheduler import scheduler
            scheduler.add_job(
                _trigger_retrain_for_adapter,
                args=[adapter_type],
                id=f"auto_retrain_{adapter_type}_{line_count}",
                replace_existing=True,
            )
    except Exception:
        pass  # Don't block claim processing if scheduler trigger fails


def _trigger_retrain_for_adapter(adapter_type: str) -> None:
    """Schedule local GLiNER2 retraining via the admin router's shared function."""
    import asyncio
    try:
        from routers.admin import _run_local_training
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_run_local_training(adapter_type, {}))
        else:
            loop.run_until_complete(_run_local_training(adapter_type, {}))
    except Exception:
        pass


async def run_pioneer_extraction(text: str, job_id: str) -> dict:
    """
    Run four-contract extraction via Pioneer's GLiNER XL 1B model.
    Used for high-stakes claims (HUMAN_ADJUSTER, FRAUD_REVIEW).
    Falls back to local GLiNER2-base if pioneer_api_key is not set.
    """
    from services.pioneer_client import run_inference

    all_labels = VEHICLE_IDENTITY_LABELS + DAMAGE_MAP_LABELS + HAZARD_LABELS + SUBMISSION_PACK_LABELS

    entity_result = await run_inference(
        task="extract_entities",
        text=text,
        schema=all_labels,
        job_id=job_id,
        threshold=0.5,
        include_confidence=True,
    )
    lane_result = await run_inference(
        task="classify_text",
        text=text,
        schema={"categories": list(LANE_CLASSES["LANE"])},
        job_id=job_id,
    )
    drivable_result = await run_inference(
        task="classify_text",
        text=text,
        schema={"categories": list(DRIVABLE_CLASSES["DRIVABLE"])},
        job_id=job_id,
    )

    entities: dict = entity_result.get("result", {}).get("entities", {})

    def _split(labels: list[str]) -> dict:
        return {lbl: entities.get(lbl, []) for lbl in labels}

    return {
        "vehicle_identity": _split(VEHICLE_IDENTITY_LABELS),
        "damage_map": _split(DAMAGE_MAP_LABELS),
        "hazards": _split(HAZARD_LABELS),
        "submission_pack": _split(SUBMISSION_PACK_LABELS),
        "lane": lane_result.get("result", {}).get("category", "HUMAN_ADJUSTER"),
        "drivable": drivable_result.get("result", {}).get("category", "UNKNOWN"),
    }


async def extract_claim(text: str, adapter_path: str | None, is_high_stakes: bool = False) -> dict:
    """
    Dispatch to Pioneer XL (async) or local GLiNER2-base depending on
    claim severity and whether a Pioneer key + model job_id are configured.
    """
    if is_high_stakes and settings.pioneer_api_key and settings.pioneer_model_job_id:
        return await run_pioneer_extraction(text, job_id=settings.pioneer_model_job_id)

    # Local inference runs on CPU — offload to thread pool to avoid blocking event loop
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        run_four_contract_extraction,
        text,
        adapter_path,
    )
