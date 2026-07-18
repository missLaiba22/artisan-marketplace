from pydantic import BaseModel
from uuid import UUID

class ArtisanProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    shop_name: str
    description: str | None
    location: str | None
    is_approved: bool

    class Config:
        from_attributes = True

class ArtisanUpdateRequest(BaseModel):
    shop_name: str
    description: str | None = None
    location: str | None = None