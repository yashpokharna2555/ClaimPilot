from pydantic import BaseModel
from models.vehicle import VehicleOut


class PolicyOut(BaseModel):
    id: str
    plan: str
    premium_monthly: float
    deductible: float
    start_date: str
    end_date: str
    status: str
    vehicles: list[VehicleOut] = []
