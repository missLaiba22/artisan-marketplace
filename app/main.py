# app/main.py
from fastapi import FastAPI
from app.modules.auth.router import router as auth_router
from app.modules.artisans.router import router as artisans_router
from app.modules.products.router import router as products_router
from app.modules.orders.router import router as orders_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Marketplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(artisans_router)
app.include_router(products_router)
app.include_router(orders_router)