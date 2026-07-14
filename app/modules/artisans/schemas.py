# app/modules/artisans/schemas.py
from pydantic import BaseModel
from uuid import UUID

class ArtisanProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    shop_name: str
    is_approved: bool

    class Config:
        from_attributes = True

class ArtisanUpdateRequest(BaseModel):
    shop_name: str