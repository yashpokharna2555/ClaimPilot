"""
Deterministic policy engine.
Computes coverage score and applies lane routing rules.
Fraud detection uses Neo4j graph queries.
"""
from neo4j import AsyncSession

from models.claim_json import ClaimJSON, RoutingDecision
from models.evidence import EvidenceBundle

# Score weights (max 100)
SCORE_WEIGHTS = {
    "vin_visible": 20,
    "plate_visible": 10,
    "wide_context": 10,
    "lighting_ok": 5,
    "damage_zone_closeup": 20,
    "midrange_damage": 10,
    "dashboard_warnings": 10,
    "wheels_underbody": 10,
    "other_party_plate": 5,
}

SHOP_ESTIMATE_THRESHOLD = 65

# Recapture hint priority order
RECAPTURE_PRIORITIES = [
    ("vin_visible", "Record the VIN plate near the driver door jamb for 3 seconds, steady close-up."),
    ("plate_visible", "Record the license plate close-up for 3 seconds, steady."),
    ("wide_context", "Record a wide shot showing the full vehicle and surrounding area."),
    ("damage_zone_closeup", "Record each damaged area close-up, holding steady for 2–3 seconds."),
    ("dashboard_warnings", "Record the dashboard showing any warning lights."),
]


def compute_coverage_score(bundle: EvidenceBundle, claim: ClaimJSON) -> int:
    """
    Compute 0–100 evidence coverage score from extracted clip types.
    """
    clip_types = {c.clip_type.upper() for c in bundle.clips}
    tag_names = {t.tag.lower() for t in bundle.tags}

    score = 0

    if claim.vehicle_identity.vin_visible or "VIN" in clip_types:
        score += SCORE_WEIGHTS["vin_visible"]

    if claim.vehicle_identity.plate_visible or "PLATE" in clip_types:
        score += SCORE_WEIGHTS["plate_visible"]

    if "WIDE" in clip_types:
        score += SCORE_WEIGHTS["wide_context"]

    # Lighting quality (absence of low_light/blur tags)
    if not any(t in tag_names for t in ("low_light", "blur", "blurry", "dark")):
        score += SCORE_WEIGHTS["lighting_ok"]

    # Damage close-ups (any DAMAGE clip type present)
    damage_clips = [c for c in bundle.clips if "DAMAGE" in c.clip_type.upper()]
    if damage_clips:
        score += SCORE_WEIGHTS["damage_zone_closeup"]

    # Mid-range damage (WIDE + DAMAGE both present signals mid-range coverage)
    if damage_clips and "WIDE" in clip_types:
        score += SCORE_WEIGHTS["midrange_damage"]

    if "DASH" in clip_types or claim.hazards.warning_lights_present:
        score += SCORE_WEIGHTS["dashboard_warnings"]

    if "WHEEL" in clip_types:
        score += SCORE_WEIGHTS["wheels_underbody"]

    if "OTHER_PARTY" in clip_types:
        score += SCORE_WEIGHTS["other_party_plate"]

    # Quality penalties
    if "low_light" in tag_names and any(t in tag_names for t in ("blur", "blurry")):
        score -= 25
    elif "low_light" in tag_names:
        score -= 10
    elif any(t in tag_names for t in ("blur", "blurry")):
        score -= 10

    return max(0, min(100, score))


def _get_missing_fields(claim: ClaimJSON, bundle: EvidenceBundle) -> list[str]:
    clip_types = {c.clip_type.upper() for c in bundle.clips}
    missing = []
    if not claim.vehicle_identity.vin_visible and "VIN" not in clip_types:
        missing.append("vin_visible")
    if not claim.vehicle_identity.plate_visible and "PLATE" not in clip_types:
        missing.append("plate_visible")
    if "WIDE" not in clip_types:
        missing.append("wide_context")
    if not any("DAMAGE" in ct for ct in clip_types):
        missing.append("damage_zone_closeup")
    if "DASH" not in clip_types and not claim.hazards.warning_lights_present:
        missing.append("dashboard_warnings")
    return missing


def get_recapture_hint(missing: list[str]) -> str | None:
    """Return exactly ONE recapture instruction, or None if all present."""
    for field, hint in RECAPTURE_PRIORITIES:
        if field in missing:
            return hint
    return None


async def fraud_check(session: AsyncSession, vin: str, user_id: str) -> str:
    """
    Run Neo4j graph queries to assess fraud risk.
    Returns: "low" | "medium" | "high"
    """
    # Vehicle in >2 claims in past 90 days
    result = await session.run(
        """
        MATCH (v:Vehicle {vin: $vin})<-[:FOR]-(c:Claim)
        WHERE c.filed_at > datetime() - duration('P90D')
        RETURN count(c) AS claim_count
        """,
        vin=vin,
    )
    record = await result.single()
    if record and record["claim_count"] > 2:
        return "high"

    # User with previous fraud-flagged claims
    result2 = await session.run(
        """
        MATCH (u:User {id: $user_id})-[:FILED]->(c:Claim)
        WHERE c.fraud_risk IN ['medium', 'high']
        RETURN count(c) AS suspicious_count
        """,
        user_id=user_id,
    )
    record2 = await result2.single()
    if record2 and record2["suspicious_count"] >= 1:
        return "medium"

    return "low"


def apply_lane_rules(
    claim: ClaimJSON,
    score: int,
    fraud_risk: str,
    missing: list[str],
) -> RoutingDecision:
    """
    Apply deterministic lane routing rules in priority order.
    Rules override GLiNER2's suggested lane when safety-critical.
    """
    review_reasons = []

    # Priority 1: TOW_REQUIRED (safety-critical overrides everything)
    if (
        claim.hazards.fluid_leak_suspected
        or claim.hazards.wheel_misalignment_suspected
        or claim.hazards.drivable.lower() == "no"
    ):
        if claim.hazards.fluid_leak_suspected:
            review_reasons.append("Fluid leak suspected — vehicle may not be safe to drive")
        if claim.hazards.wheel_misalignment_suspected:
            review_reasons.append("Wheel/tire damage suspected")
        if claim.hazards.drivable.lower() == "no":
            review_reasons.append("Vehicle assessed as not drivable")
        return RoutingDecision(
            lane="TOW_REQUIRED",
            coverage_score=score,
            fraud_risk=fraud_risk,
            review_reasons=review_reasons,
            recapture_hint=get_recapture_hint(missing),
        )

    # Priority 2: FRAUD_REVIEW
    if fraud_risk == "high":
        review_reasons.append("Graph analysis detected suspicious claim pattern")
        return RoutingDecision(
            lane="FRAUD_REVIEW",
            coverage_score=score,
            fraud_risk=fraud_risk,
            review_reasons=review_reasons,
            recapture_hint=get_recapture_hint(missing),
        )

    # Priority 3: HUMAN_ADJUSTER
    adjuster_triggers = []
    if claim.damage_map.severity.lower() == "high":
        adjuster_triggers.append("High severity damage")
    if claim.hazards.airbag_deployed:
        adjuster_triggers.append("Airbag deployment detected")
    if len(claim.damage_map.damage_zones) >= 4:
        adjuster_triggers.append(f"{len(claim.damage_map.damage_zones)} damage zones identified")
    if score < 40:
        adjuster_triggers.append(f"Evidence coverage score too low ({score}/100)")

    if adjuster_triggers:
        return RoutingDecision(
            lane="HUMAN_ADJUSTER",
            coverage_score=score,
            fraud_risk=fraud_risk,
            review_reasons=adjuster_triggers,
            recapture_hint=get_recapture_hint(missing),
        )

    # Priority 4: SHOP_ESTIMATE
    if (
        score >= SHOP_ESTIMATE_THRESHOLD
        and claim.hazards.drivable.lower() in ("yes", "unknown")
        and claim.damage_map.severity.lower() in ("low", "moderate", "unknown")
    ):
        return RoutingDecision(
            lane="SHOP_ESTIMATE",
            coverage_score=score,
            fraud_risk=fraud_risk,
            review_reasons=[],
            recapture_hint=get_recapture_hint(missing),
        )

    # Default fallback
    return RoutingDecision(
        lane="HUMAN_ADJUSTER",
        coverage_score=score,
        fraud_risk=fraud_risk,
        review_reasons=["Insufficient evidence for automated routing"],
        recapture_hint=get_recapture_hint(missing),
    )
