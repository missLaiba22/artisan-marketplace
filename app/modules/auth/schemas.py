from pydantic import BaseModel, EmailStr
from uuid import UUID
from app.modules.auth.models import UserRole

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    role: UserRole

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str | None
    role: UserRole

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"