# app/modules/products/router.py
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.artisans.dependencies import require_approved_artisan
from app.modules.products.schemas import ProductCreateRequest, ProductUpdateRequest, ProductResponse
from app.modules.products.service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


# --- Public routes (no auth) ---

@router.get("", response_model=list[ProductResponse])
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return ProductService(db).list_products(skip=skip, limit=limit)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    return ProductService(db).get_product(product_id)


# --- Artisan-only routes ---

@router.get("/me/listings", response_model=list[ProductResponse])
def list_my_products(
    artisan = Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return ProductService(db).list_my_products(artisan.id)


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreateRequest,
    artisan = Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return ProductService(db).create_product(artisan.id, data)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    data: ProductUpdateRequest,
    artisan = Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return ProductService(db).update_product(product_id, artisan.id, data)


@router.delete("/{product_id}", response_model=ProductResponse)
def delete_product(
    product_id: UUID,
    artisan = Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return ProductService(db).delete_product(product_id, artisan.id)
@router.patch("/{product_id}/restore", response_model=ProductResponse)
def restore_product(
    product_id: UUID,
    artisan = Depends(require_approved_artisan),
    db: Session = Depends(get_db),
):
    return ProductService(db).restore_product(product_id, artisan.id)