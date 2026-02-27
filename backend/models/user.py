from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: str
    license_state: str
