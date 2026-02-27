from pydantic import BaseModel


class SubmissionOut(BaseModel):
    id: str
    destination_url: str | None = None
    yutori_task_id: str | None = None
    confirmation_id: str | None = None
    insure_co_claim_id: str | None = None
    scout_id: str | None = None
    scout_status: str | None = None
    status: str  # pending | running | succeeded | failed
    submitted_at: str | None = None


class SubmitRequest(BaseModel):
    destination_url: str | None = None  # defaults to settings.insurance_portal_url
