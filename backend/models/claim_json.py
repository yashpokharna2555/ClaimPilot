from pydantic import BaseModel


class VehicleIdentity(BaseModel):
    vin_visible: bool = False
    plate_visible: bool = False
    make_model_guess: str | None = None
    odometer_visible: bool = False


class DamageMap(BaseModel):
    damage_zones: list[str] = []
    damage_types: list[str] = []
    severity: str = "unknown"  # low | moderate | high | unknown


class HazardDrivability(BaseModel):
    airbag_deployed: bool = False
    fluid_leak_suspected: bool = False
    wheel_misalignment_suspected: bool = False
    warning_lights_present: bool = False
    glass_damage: bool = False
    drivable: str = "unknown"  # yes | no | unknown


class SubmissionPack(BaseModel):
    required_fields_present: list[str] = []
    missing_fields: list[str] = []
    recommended_next_capture: str | None = None


class RoutingDecision(BaseModel):
    lane: str  # SHOP_ESTIMATE | TOW_REQUIRED | HUMAN_ADJUSTER | FRAUD_REVIEW
    coverage_score: int
    fraud_risk: str  # low | medium | high
    review_reasons: list[str] = []
    recapture_hint: str | None = None


class ClaimJSON(BaseModel):
    vehicle_identity: VehicleIdentity
    damage_map: DamageMap
    hazards: HazardDrivability
    submission_pack: SubmissionPack
    routing: RoutingDecision
