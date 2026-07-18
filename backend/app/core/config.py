from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/marketplace"
    jwt_secret: str = "CHANGE_ME_IN_ENV"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"

    @field_validator("database_url")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        # Render (and some other providers) hand out postgres:// —
        # SQLAlchemy 2.x only accepts postgresql://. Normalize here so
        # it's correct regardless of what gets pasted into the env var.
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    class Config:
        env_file = ".env"

settings = Settings()