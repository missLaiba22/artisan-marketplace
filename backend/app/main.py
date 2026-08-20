# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.auth.oauth_router import router as oauth_router
from app.modules.artisans.router import router as artisans_router
from app.modules.products.router import router as products_router
from app.modules.orders.router import router as orders_router
from app.modules.orders.webhook_router import router as stripe_webhook_router
from app.modules.promotions.router import router as promotions_router
app = FastAPI(title="Marketplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Required by Authlib to store the OAuth `state` value between the
# /auth/google/login redirect and the /auth/google/callback request.
# Reuses jwt_secret rather than introducing a second secret to manage —
# fine here since this cookie only ever holds a short-lived, low-sensitivity
# state token, never user data.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(artisans_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(stripe_webhook_router)
app.include_router(promotions_router)