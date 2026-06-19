"""Search routes – full-text, semantic, and direct YouTube search."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query as QueryParam

from models.schemas import SearchResult
from services import youtube_service
from services.youtube_service import YouTubeAPIError, YouTubeQuotaExceeded

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])


def _get_services():
    """Lazy import to avoid circular imports at module load time."""
    from main import es_service, vector_service
    return es_service, vector_service


# ── GET /api/search/text ──────────────────────────────────────────────────────

@router.get("/text", response_model=SearchResult)
async def text_search(
    q: str = QueryParam(..., min_length=1, description="Search query"),
    page: int = QueryParam(default=1, ge=1),
    per_page: int = QueryParam(default=20, ge=1, le=100),
):
    """Full-text search via Elasticsearch."""
    es_service, _ = _get_services()

    if es_service is None:
        raise HTTPException(status_code=503, detail="Elasticsearch is not available")

    try:
        result = await es_service.search(query=q, page=page, per_page=per_page)
        return SearchResult(
            videos=result["videos"],
            total=result["total"],
            source="es",
        )
    except Exception as e:
        logger.exception("Elasticsearch search failed")
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


# ── GET /api/search/semantic ─────────────────────────────────────────────────

@router.get("/semantic", response_model=SearchResult)
async def semantic_search(
    q: str = QueryParam(..., min_length=1, description="Search query"),
    n_results: int = QueryParam(default=20, ge=1, le=100),
):
    """Semantic (vector) search via ChromaDB."""
    _, vector_service = _get_services()

    if vector_service is None:
        raise HTTPException(status_code=503, detail="Vector service is not available")

    try:
        videos = vector_service.semantic_search(query=q, n_results=n_results)
        return SearchResult(
            videos=videos,
            total=len(videos),
            source="vector",
        )
    except Exception as e:
        logger.exception("Semantic search failed")
        raise HTTPException(status_code=500, detail=f"Semantic search failed: {e}")


# ── GET /api/search/youtube ──────────────────────────────────────────────────

@router.get("/youtube", response_model=SearchResult)
async def youtube_search(
    q: str = QueryParam(..., min_length=1, description="Search query"),
    max_results: int = QueryParam(default=20, ge=1, le=50),
):
    """Direct YouTube API search (expensive – 100 quota units)."""
    try:
        videos = await youtube_service.search_videos(query=q, max_results=max_results)
        return SearchResult(
            videos=videos,
            total=len(videos),
            source="youtube",
        )
    except YouTubeQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except YouTubeAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("YouTube search failed")
        raise HTTPException(status_code=500, detail=f"YouTube search failed: {e}")


# ── GET /api/search/similar/{video_id} ───────────────────────────────────────

@router.get("/similar/{video_id}")
async def find_similar(
    video_id: str,
    n_results: int = QueryParam(default=10, ge=1, le=50),
):
    """Find videos similar to the given video ID via ChromaDB."""
    _, vector_service = _get_services()

    if vector_service is None:
        raise HTTPException(status_code=503, detail="Vector service is not available")

    try:
        videos = vector_service.find_similar(video_id=video_id, n_results=n_results)
        return {
            "videos": videos,
            "total": len(videos),
            "source": "vector",
            "query_video_id": video_id,
        }
    except Exception as e:
        logger.exception("Find-similar failed")
        raise HTTPException(status_code=500, detail=f"Find-similar failed: {e}")
