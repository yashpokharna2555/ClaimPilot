from pydantic import BaseModel


class VehicleCreate(BaseModel):
    vin: str
    plate: str
    make: str
    model: str
    year: int
    color: str


class VehicleOut(BaseModel):
    vin: str
    plate: str
    make: str
    model: str
    year: int
    color: str
