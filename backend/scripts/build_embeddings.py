"""
Populates document_embeddings from current products + artisans.
Idempotent — upserts by (source_type, source_id), safe to re-run any time
the catalog changes (no incremental sync yet — that's a V2 concern).

Run: python scripts/build_embeddings.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.modules.products.models import Product
from app.modules.artisans.models import Artisan
from app.modules.chatbot.models import SourceType
from app.modules.chatbot.repository import EmbeddingRepository
from app.modules.chatbot.embedding_service import embed_text

def build_product_text(product) -> str:
    parts = [product.name, f"Price: {product.price} USD"]
    if product.description:
        parts.append(product.description)
    return ". ".join(parts)

def build_artisan_text(artisan) -> str:
    parts = [artisan.shop_name]
    if artisan.description:
        parts.append(artisan.description)
    if artisan.location:
        parts.append(f"Located in {artisan.location}")
    return ". ".join(parts)


def run():
    db = SessionLocal()
    repo = EmbeddingRepository(db)
    try:
        products = db.query(Product).filter(Product.is_active.is_(True)).all()
        for p in products:
            text = build_product_text(p)
            repo.upsert(SourceType.PRODUCT, p.id, text, embed_text(text))

        artisans = db.query(Artisan).filter(Artisan.is_approved.is_(True)).all()
        for a in artisans:
            text = build_artisan_text(a)
            repo.upsert(SourceType.ARTISAN, a.id, text, embed_text(text))

        db.commit()
        print(f"Embedded {len(products)} products and {len(artisans)} artisans.")
    finally:
        db.close()


if __name__ == "__main__":
    run()