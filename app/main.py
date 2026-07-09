from fastapi import FastAPI
from app.modules.auth.router import router as auth_router

app = FastAPI(title="Marketplace API")

app.include_router(auth_router)