"""Elasticsearch service for full-text video search and indexing."""

from __future__ import annotations

import logging
from typing import Any

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk

logger = logging.getLogger(__name__)

INDEX_NAME = "youtube_videos"

# Index mapping – optimised for full-text search on title/description and
# keyword aggregations on structured fields.
INDEX_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "default": {
                    "type": "standard",
                }
            }
        },
    },
    "mappings": {
        "properties": {
            "video_id":       {"type": "keyword"},
            "title":          {"type": "text", "analyzer": "standard"},
            "description":    {"type": "text", "analyzer": "standard"},
            "channel_id":     {"type": "keyword"},
            "channel_title":  {"type": "keyword"},
            "published_at":   {"type": "date"},
            "view_count":     {"type": "long"},
            "like_count":     {"type": "long"},
            "comment_count":  {"type": "long"},
            "duration":       {"type": "keyword"},
            "thumbnail_url":  {"type": "keyword", "index": False},
            "tags":           {"type": "keyword"},
            "category_id":    {"type": "keyword"},
        }
    },
}


class ElasticsearchService:
    """Thin async wrapper around the Elasticsearch Python client."""

    def __init__(self, es_url: str) -> None:
        self.es = AsyncElasticsearch(
            hosts=[es_url],
            request_timeout=30,
            max_retries=3,
            retry_on_timeout=True,
        )

    # ── Index management ──────────────────────────────────────────────────

    async def create_index(self) -> None:
        """Create the video index if it doesn't already exist."""
        exists = await self.es.indices.exists(index=INDEX_NAME)
        if not exists:
            await self.es.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
            logger.info("Created Elasticsearch index '%s'", INDEX_NAME)
        else:
            logger.info("Elasticsearch index '%s' already exists", INDEX_NAME)

    async def delete_index(self) -> None:
        """Delete the index (useful for full reindex)."""
        exists = await self.es.indices.exists(index=INDEX_NAME)
        if exists:
            await self.es.indices.delete(index=INDEX_NAME)
            logger.info("Deleted Elasticsearch index '%s'", INDEX_NAME)

    # ── Indexing ──────────────────────────────────────────────────────────

    async def index_videos(self, videos: list[dict[str, Any]]) -> int:
        """Bulk-index a list of video dicts.  Returns number of indexed docs."""
        if not videos:
            return 0

        actions = []
        for v in videos:
            doc = {
                "_index": INDEX_NAME,
                "_id": v["id"],  # use video ID as doc ID → upsert semantics
                "_source": {
                    "video_id":      v["id"],
                    "title":         v.get("title", ""),
                    "description":   v.get("description", ""),
                    "channel_id":    v.get("channel_id", ""),
                    "channel_title": v.get("channel_title", ""),
                    "published_at":  v.get("published_at"),
                    "view_count":    v.get("view_count", 0),
                    "like_count":    v.get("like_count", 0),
                    "comment_count": v.get("comment_count", 0),
                    "duration":      v.get("duration", ""),
                    "thumbnail_url": v.get("thumbnail_url", ""),
                    "tags":          v.get("tags", []),
                    "category_id":   v.get("category_id"),
                },
            }
            actions.append(doc)

        success, errors = await async_bulk(self.es, actions, raise_on_error=False)
        if errors:
            logger.warning("Bulk indexing had %d errors", len(errors))
        logger.info("Indexed %d videos in Elasticsearch", success)
        return success

    # ── Search ────────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        page: int = 1,
        per_page: int = 25,
    ) -> dict[str, Any]:
        """Full-text multi_match search on title + description with pagination."""
        from_ = (page - 1) * per_page

        body = {
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^3", "description"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                }
            },
            "from": from_,
            "size": per_page,
            "sort": [
                {"_score": "desc"},
                {"view_count": "desc"},
            ],
        }

        resp = await self.es.search(index=INDEX_NAME, body=body)
        hits = resp["hits"]
        total = hits["total"]["value"] if isinstance(hits["total"], dict) else hits["total"]

        videos = []
        for hit in hits["hits"]:
            src = hit["_source"]
            src["_score"] = hit["_score"]
            videos.append(src)

        return {"videos": videos, "total": total}

    # ── Utility ───────────────────────────────────────────────────────────

    async def get_count(self) -> int:
        """Return the number of documents in the index."""
        try:
            resp = await self.es.count(index=INDEX_NAME)
            return resp["count"]
        except Exception:
            return 0

    async def is_healthy(self) -> bool:
        """Check cluster health (green or yellow is acceptable)."""
        try:
            health = await self.es.cluster.health()
            return health["status"] in ("green", "yellow")
        except Exception:
            return False

    async def close(self) -> None:
        """Close the underlying transport."""
        await self.es.close()
