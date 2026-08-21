from sqlalchemy.orm import Session
from app.modules.chatbot.models import DocumentEmbedding, SourceType


class EmbeddingRepository:
    def __init__(self, db: Session):
        self.db = db

    def upsert(self, source_type: SourceType, source_id, content: str, embedding: list[float]):
        existing = (
            self.db.query(DocumentEmbedding)
            .filter(
                DocumentEmbedding.source_type == source_type,
                DocumentEmbedding.source_id == source_id,
            )
            .first()
        )
        if existing:
            existing.content = content
            existing.embedding = embedding
        else:
            self.db.add(DocumentEmbedding(
                source_type=source_type, source_id=source_id,
                content=content, embedding=embedding,
            ))
        self.db.flush()  # repos flush, services commit — same rule as everywhere else

    def search(self, query_embedding: list[float], limit: int = 5) -> list[DocumentEmbedding]:
        # .cosine_distance() is pgvector-python's SQLAlchemy hook for the `<=>` operator.
        # No index yet — exact scan is fine at ~30 rows. This is the literal
        # "indexing" item on your roadmap once the catalog grows (ivfflat/hnsw).
        return (
            self.db.query(DocumentEmbedding)
            .order_by(DocumentEmbedding.embedding.cosine_distance(query_embedding))
            .limit(limit)
            .all()
        )