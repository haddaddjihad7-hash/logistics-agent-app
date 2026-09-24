import os
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

logger = logging.getLogger(__name__)

# Default persistent directory for ChromaDB within backend
CHROMA_PERSIST_DIR = Path(__file__).resolve().parent / "chroma_db"
COLLECTION_NAME = "episodic_memory"
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_cached_embedding_fn = None

def get_embedding_function():
    global _cached_embedding_fn
    if _cached_embedding_fn is None:
        _cached_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBEDDING_MODEL_NAME
        )
    return _cached_embedding_fn


def get_episodic_vector_store(
    persist_dir: Optional[str] = None,
    collection_name: str = COLLECTION_NAME
) -> chromadb.Collection:
    """
    Initializes a local persistent ChromaDB client and retrieves or creates
    the Episodic Memory collection with cosine distance metric.
    """
    db_path = str(persist_dir or CHROMA_PERSIST_DIR)
    os.makedirs(db_path, exist_ok=True)

    client = chromadb.PersistentClient(
        path=db_path,
        settings=Settings(anonymized_telemetry=False)
    )

    embedding_fn = get_embedding_function()

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine", "description": "Episodic memory for historical logistics incidents and executions"},
        embedding_function=embedding_fn
    )
    logger.info(f"Initialized ChromaDB Episodic Vector Store at '{db_path}', collection: '{collection_name}' (count: {collection.count()})")
    return collection


def store_episodic_chunks(
    vector_store: chromadb.Collection,
    chunks: List[str],
    metadatas: Optional[List[Dict[str, Any]]] = None,
    ids: Optional[List[str]] = None,
    batch_size: int = 64
) -> int:
    """
    Stores episodic vectors (historical incident records and logs) in ChromaDB in batches.
    """
    if not chunks:
        logger.warning("No chunks provided to store.")
        return 0

    total_added = 0
    total = len(chunks)

    for i in range(0, total, batch_size):
        batch_chunks = chunks[i : i + batch_size]
        batch_metadatas = metadatas[i : i + batch_size] if metadatas else None
        batch_ids = ids[i : i + batch_size] if ids else [f"ep_{i + j}" for j in range(len(batch_chunks))]

        vector_store.upsert(
            documents=batch_chunks,
            metadatas=batch_metadatas,
            ids=batch_ids
        )
        total_added += len(batch_chunks)

    logger.info(f"Successfully upserted {total_added} episodic vectors into ChromaDB.")
    return total_added


def retrieve_episodic_context(
    query: str,
    vector_store: chromadb.Collection,
    k: int = 3
) -> List[Dict[str, Any]]:
    """
    Retrieves the most semantically relevant historical incident records and past events
    from the episodic memory vector store.
    """
    if not query or not query.strip():
        return []

    try:
        count = vector_store.count()
        if count == 0:
            logger.warning("Episodic Vector Store is empty. Ingest historical data first.")
            return []

        fetch_k = min(k, count)
        results = vector_store.query(
            query_texts=[query],
            n_results=fetch_k,
            include=["documents", "metadatas", "distances"]
        )

        episodic_records = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
            ids = results["ids"][0] if results.get("ids") else [None] * len(docs)

            for doc, meta, dist, record_id in zip(docs, metas, distances, ids):
                similarity = round(max(0.0, 1.0 - dist), 4)
                episodic_records.append({
                    "id": record_id,
                    "content": doc,
                    "metadata": meta,
                    "similarity": similarity
                })

        return episodic_records
    except Exception as e:
        logger.warning(f"Error querying episodic context: {e}")
        return []


def format_episodic_grounding_prompt(records: List[Dict[str, Any]]) -> str:
    """
    Helper function to format retrieved episodic incident records into a concise
    context block ready to inject into the LLM system prompt.
    """
    if not records:
        return "No historical episodic records found for this context."

    lines = ["### Historical Episodic Context (Past Similar Incidents & Outcomes):"]
    for idx, rec in enumerate(records, start=1):
        lines.append(f"\n[Past Incident #{idx}] (Relevance Score: {rec.get('similarity', 0.0)}):")
        lines.append(f"{rec.get('content', '').strip()}")
        if rec.get("metadata"):
            lines.append(f"Metadata: {rec['metadata']}")
    return "\n".join(lines)
