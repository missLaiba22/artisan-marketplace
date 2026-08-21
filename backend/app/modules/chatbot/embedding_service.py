from sentence_transformers import SentenceTransformer

_model = None  # lazy-loaded singleton — loading the model is slow (~1-2s), don't do it per-request


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_text(text: str) -> list[float]:
    model = get_embedding_model()
    # normalize_embeddings=True: unit-length vectors, so cosine distance
    # and dot-product search give equivalent rankings — keeps the query
    # side of pgvector search simple and consistent.
    return model.encode(text, normalize_embeddings=True).tolist()