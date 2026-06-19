"""ChromaDB vector service for semantic video search.

Uses sentence-transformers/all-MiniLM-L6-v2 to embed video titles and
descriptions, then stores them in a ChromaDB collection for similarity queries.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

COLLECTION_NAME = "youtube_videos"


class VectorService:
    """Manages embeddings and semantic search via ChromaDB."""

    def __init__(self, host: str, port: int, model_name: str) -> None:
        self.host = host
        self.port = port
        self.model_name = model_name
        self.client: Any = None
        self.collection: Any = None
        self.model: SentenceTransformer | None = None

    # ── Initialisation ────────────────────────────────────────────────────

    def load_model(self) -> None:
        """Load the sentence-transformer model (CPU).  Called once at startup."""
        logger.info("Loading embedding model '%s' …", self.model_name)
        self.model = SentenceTransformer(self.model_name)
        # Use the newer method name if available, fall back to legacy
        dim_fn = getattr(self.model, "get_embedding_dimension",
                         getattr(self.model, "get_sentence_embedding_dimension", None))
        dim = dim_fn() if dim_fn else "unknown"
        logger.info("Embedding model loaded (dim=%s)", dim)

    def init_collection(self) -> None:
        """Connect to ChromaDB and get-or-create the collection.

        Tries HttpClient first (for Docker deployments). If that fails,
        falls back to PersistentClient (local file storage) which works
        regardless of server version.
        """
        # Attempt 1: HttpClient (Docker / remote server)
        try:
            self.client = chromadb.HttpClient(host=self.host, port=self.port)
            self.client.heartbeat()  # test connectivity
            self.collection = self.client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(
                "ChromaDB (HTTP %s:%s) collection '%s' ready (%d docs)",
                self.host, self.port, COLLECTION_NAME, self.collection.count(),
            )
            return
        except Exception as http_err:
            logger.warning("ChromaDB HttpClient failed: %s — falling back to local storage", http_err)

        # Attempt 2: PersistentClient (local file storage, no server needed)
        import os
        data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".chromadb_data")
        os.makedirs(data_dir, exist_ok=True)

        self.client = chromadb.PersistentClient(path=data_dir)
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB (local: %s) collection '%s' ready (%d docs)",
            data_dir, COLLECTION_NAME, self.collection.count(),
        )

    # ── Indexing ──────────────────────────────────────────────────────────

    def _embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        if self.model is None:
            raise RuntimeError("Embedding model not loaded – call load_model() first")
        embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        return embeddings.tolist()

    def add_videos(self, videos: list[dict[str, Any]]) -> int:
        """Generate embeddings and upsert videos into the collection.

        Returns the number of documents added.
        """
        if not videos or self.collection is None:
            return 0

        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, Any]] = []
        embeddings_input: list[str] = []

        for v in videos:
            vid = v.get("id", "")
            title = v.get("title", "")
            desc = v.get("description", "")
            text = f"{title} {desc}".strip()
            if not vid or not text:
                continue

            ids.append(vid)
            documents.append(text[:1000])  # ChromaDB doc for display
            embeddings_input.append(text[:512])  # limit embedding input
            metadatas.append({
                "title": title[:500],
                "channel_id": v.get("channel_id", ""),
                "channel_title": v.get("channel_title", ""),
                "published_at": v.get("published_at", ""),
                "view_count": v.get("view_count", 0),
                "like_count": v.get("like_count", 0),
                "thumbnail_url": v.get("thumbnail_url", ""),
                "duration": v.get("duration", ""),
                "category_id": v.get("category_id", ""),
            })

        if not ids:
            return 0

        vecs = self._embed(embeddings_input)

        # Upsert in batches of 100 (ChromaDB limit)
        batch_size = 100
        total_added = 0
        for i in range(0, len(ids), batch_size):
            end = i + batch_size
            self.collection.upsert(
                ids=ids[i:end],
                embeddings=vecs[i:end],
                documents=documents[i:end],
                metadatas=metadatas[i:end],
            )
            total_added += len(ids[i:end])

        logger.info("Upserted %d videos into ChromaDB", total_added)
        return total_added

    # ── Search ────────────────────────────────────────────────────────────

    def semantic_search(
        self,
        query: str,
        n_results: int = 20,
    ) -> list[dict[str, Any]]:
        """Perform a semantic (vector) search and return ranked results."""
        if self.collection is None:
            return []

        query_embedding = self._embed([query[:512]])[0]

        # Make sure n_results doesn't exceed collection size
        count = self.collection.count()
        if count == 0:
            return []
        n = min(n_results, count)

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n,
            include=["metadatas", "distances", "documents"],
        )

        videos: list[dict[str, Any]] = []
        if results and results.get("ids"):
            for idx, vid_id in enumerate(results["ids"][0]):
                meta = results["metadatas"][0][idx] if results.get("metadatas") else {}
                distance = results["distances"][0][idx] if results.get("distances") else 0.0
                doc = results["documents"][0][idx] if results.get("documents") else ""

                videos.append({
                    "id": vid_id,
                    "title": meta.get("title", ""),
                    "channel_id": meta.get("channel_id", ""),
                    "channel_title": meta.get("channel_title", ""),
                    "published_at": meta.get("published_at", ""),
                    "view_count": meta.get("view_count", 0),
                    "like_count": meta.get("like_count", 0),
                    "thumbnail_url": meta.get("thumbnail_url", ""),
                    "duration": meta.get("duration", ""),
                    "category_id": meta.get("category_id", ""),
                    "description": doc[:300] if doc else "",
                    "similarity_score": round(1 - distance, 4),  # cosine: lower distance = more similar
                })

        return videos

    def find_similar(
        self,
        video_id: str,
        n_results: int = 10,
    ) -> list[dict[str, Any]]:
        """Find videos similar to a given video ID using its stored embedding."""
        if self.collection is None:
            return []

        # Get the embedding for the given video
        try:
            result = self.collection.get(
                ids=[video_id],
                include=["embeddings"],
            )
        except Exception:
            logger.warning("Video %s not found in ChromaDB", video_id)
            return []

        if not result or not result.get("embeddings") or not result["embeddings"]:
            logger.warning("No embedding found for video %s", video_id)
            return []

        embedding = result["embeddings"][0]

        count = self.collection.count()
        if count <= 1:
            return []
        n = min(n_results + 1, count)  # +1 because the video itself will match

        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=n,
            include=["metadatas", "distances", "documents"],
        )

        videos: list[dict[str, Any]] = []
        if results and results.get("ids"):
            for idx, vid_id in enumerate(results["ids"][0]):
                if vid_id == video_id:
                    continue  # skip the query video itself
                meta = results["metadatas"][0][idx] if results.get("metadatas") else {}
                distance = results["distances"][0][idx] if results.get("distances") else 0.0
                doc = results["documents"][0][idx] if results.get("documents") else ""

                videos.append({
                    "id": vid_id,
                    "title": meta.get("title", ""),
                    "channel_id": meta.get("channel_id", ""),
                    "channel_title": meta.get("channel_title", ""),
                    "published_at": meta.get("published_at", ""),
                    "view_count": meta.get("view_count", 0),
                    "like_count": meta.get("like_count", 0),
                    "thumbnail_url": meta.get("thumbnail_url", ""),
                    "duration": meta.get("duration", ""),
                    "category_id": meta.get("category_id", ""),
                    "description": doc[:300] if doc else "",
                    "similarity_score": round(1 - distance, 4),
                })

        return videos[:n_results]

    # ── Utility ───────────────────────────────────────────────────────────

    def get_count(self) -> int:
        """Return the number of documents in the collection."""
        if self.collection is None:
            return 0
        return self.collection.count()

    def is_healthy(self) -> bool:
        """Check ChromaDB availability."""
        try:
            if self.client is None:
                return False
            # HttpClient has heartbeat(), PersistentClient is always healthy
            if hasattr(self.client, "heartbeat"):
                self.client.heartbeat()
            return self.collection is not None
        except Exception:
            return False
