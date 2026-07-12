from pydantic import BaseModel, EmailStr, model_validator
from uuid import UUID
from app.modules.auth.models import UserRole

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    role: UserRole
    shop_name: str | None = None

    @model_validator(mode="after")
    def validate_artisan_fields(self):
        if self.role == UserRole.ARTISAN and not self.shop_name:
            raise ValueError("shop_name is required when registering as an artisan")
        return self

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