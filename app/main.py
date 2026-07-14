from fastapi import FastAPI
from app.modules.auth.router import router as auth_router
from app.modules.artisans.router import router as artisans_router

app = FastAPI(title="Marketplace API")

app.include_router(auth_router)
app.include_router(artisans_router)