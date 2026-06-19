"""Channel routes – resolve, analyze, and retrieve channel data."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from models.schemas import (
    ChannelAnalysisResponse,
    ChannelInfo,
    ChannelQuery,
    AnalyticsData,
)
from services import youtube_service
from services.youtube_service import (
    ChannelNotFound,
    YouTubeAPIError,
    YouTubeQuotaExceeded,
)
from services.analytics_service import compute_full_analytics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/channel", tags=["channel"])


def _get_services():
    """Lazy import to avoid circular imports at module load time."""
    from main import es_service, vector_service
    return es_service, vector_service


# ── POST /api/channel/analyze ─────────────────────────────────────────────────

@router.post("/analyze", response_model=ChannelAnalysisResponse)
async def analyze_channel(body: ChannelQuery):
    """Resolve a channel query, fetch videos, index them, and return analytics.

    The query can be a YouTube URL, @handle, or channel ID.
    """
    es_service, vector_service = _get_services()

    try:
        # 1. Resolve to channel ID
        channel_id = await youtube_service.resolve_channel(body.query)

        # 2. Get channel metadata
        channel_data = await youtube_service.get_channel_info(channel_id)
        channel_info = ChannelInfo(**channel_data)

        # 3. Get recent videos (up to 50)
        videos = await youtube_service.get_channel_videos(channel_id, max_results=50)

        # 4. Index in Elasticsearch
        indexed_count = 0
        if es_service:
            try:
                indexed_count = await es_service.index_videos(videos)
            except Exception as e:
                logger.error("Failed to index videos in ES: %s", e)

        # 5. Index in ChromaDB
        if vector_service:
            try:
                vector_service.add_videos(videos)
            except Exception as e:
                logger.error("Failed to index videos in ChromaDB: %s", e)

        # 6. Compute analytics
        analytics_data = compute_full_analytics(videos)
        analytics = AnalyticsData(**analytics_data)

        return ChannelAnalysisResponse(
            channel=channel_info,
            analytics=analytics,
            video_count_indexed=indexed_count,
        )

    except ChannelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except YouTubeQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except YouTubeAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error analyzing channel")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


# ── GET /api/channel/{channel_id}/videos ──────────────────────────────────────

@router.get("/{channel_id}/videos")
async def get_channel_videos(
    channel_id: str,
    max_results: int = Query(default=50, ge=1, le=200),
):
    """Return paginated video list for a channel (fetched live from YouTube)."""
    try:
        videos = await youtube_service.get_channel_videos(channel_id, max_results=max_results)
        return {"videos": videos, "total": len(videos), "channel_id": channel_id}
    except ChannelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except YouTubeQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except YouTubeAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Error fetching channel videos")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/channel/{channel_id}/analytics ───────────────────────────────────

@router.get("/{channel_id}/analytics")
async def get_channel_analytics(
    channel_id: str,
    max_results: int = Query(default=50, ge=1, le=200),
):
    """Compute and return analytics for a channel's recent videos."""
    try:
        videos = await youtube_service.get_channel_videos(channel_id, max_results=max_results)
        analytics_data = compute_full_analytics(videos)
        return AnalyticsData(**analytics_data)
    except ChannelNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except YouTubeQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except YouTubeAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Error computing analytics")
        raise HTTPException(status_code=500, detail=str(e))
