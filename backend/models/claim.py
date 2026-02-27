from pydantic import BaseModel
from models.claim_json import ClaimJSON
from models.evidence import EvidenceBundle


class ClaimCreate(BaseModel):
    incident_date: str | None = None
    description: str | None = None


class ClaimOut(BaseModel):
    id: str
    session_id: str
    status: str
    incident_type: str
    filed_at: str
    lane: str | None = None
    coverage_score: int | None = None
    fraud_risk: str | None = None


class ClaimDetail(ClaimOut):
    vin: str | None = None
    claim_json: ClaimJSON | None = None
    evidence_bundle: EvidenceBundle | None = None
