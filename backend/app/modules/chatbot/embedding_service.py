import os
import numpy as np
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()

_client = InferenceClient(
    provider="hf-inference",
    api_key=os.environ["HF_TOKEN"],
)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def embed_text(text: str) -> list[float]:
    embedding = _client.feature_extraction(
        text,
        model=MODEL_NAME,
    )

    embedding = np.asarray(embedding, dtype=np.float32)

    # Equivalent to normalize_embeddings=True
    norm = np.linalg.norm(embedding)

    if norm == 0:
        raise ValueError("Embedding has zero magnitude.")

    embedding = embedding / norm

    return embedding.tolist()