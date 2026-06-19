"""Trending routes – fetch currently trending videos from YouTube."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services import youtube_service
from services.youtube_service import YouTubeAPIError, YouTubeQuotaExceeded

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trending", tags=["trending"])

# Region list – covers the most common YouTube regions
REGIONS = [
    {"code": "US", "name": "United States"},
    {"code": "GB", "name": "United Kingdom"},
    {"code": "CA", "name": "Canada"},
    {"code": "AU", "name": "Australia"},
    {"code": "IN", "name": "India"},
    {"code": "DE", "name": "Germany"},
    {"code": "FR", "name": "France"},
    {"code": "BR", "name": "Brazil"},
    {"code": "JP", "name": "Japan"},
    {"code": "KR", "name": "South Korea"},
    {"code": "MX", "name": "Mexico"},
    {"code": "RU", "name": "Russia"},
    {"code": "IT", "name": "Italy"},
    {"code": "ES", "name": "Spain"},
    {"code": "NL", "name": "Netherlands"},
    {"code": "SE", "name": "Sweden"},
    {"code": "PL", "name": "Poland"},
    {"code": "AR", "name": "Argentina"},
    {"code": "ZA", "name": "South Africa"},
    {"code": "NG", "name": "Nigeria"},
    {"code": "PH", "name": "Philippines"},
    {"code": "ID", "name": "Indonesia"},
    {"code": "TH", "name": "Thailand"},
    {"code": "VN", "name": "Vietnam"},
    {"code": "EG", "name": "Egypt"},
    {"code": "TR", "name": "Turkey"},
    {"code": "SA", "name": "Saudi Arabia"},
    {"code": "AE", "name": "United Arab Emirates"},
    {"code": "SG", "name": "Singapore"},
    {"code": "MY", "name": "Malaysia"},
]

# Video category IDs exposed to the frontend
CATEGORIES = [
    {"id": "1",  "name": "Film & Animation"},
    {"id": "2",  "name": "Autos & Vehicles"},
    {"id": "10", "name": "Music"},
    {"id": "15", "name": "Pets & Animals"},
    {"id": "17", "name": "Sports"},
    {"id": "20", "name": "Gaming"},
    {"id": "22", "name": "People & Blogs"},
    {"id": "23", "name": "Comedy"},
    {"id": "24", "name": "Entertainment"},
    {"id": "25", "name": "News & Politics"},
    {"id": "26", "name": "Howto & Style"},
    {"id": "27", "name": "Education"},
    {"id": "28", "name": "Science & Technology"},
]


# ── GET /api/trending ────────────────────────────────────────────────────────

@router.get("/")
async def get_trending(
    region: str = Query(default="US", min_length=2, max_length=2),
    category_id: Optional[str] = Query(default=None),
    max_results: int = Query(default=25, ge=1, le=50),
):
    """Fetch currently trending (most popular) videos from YouTube."""
    try:
        videos = await youtube_service.get_trending_videos(
            region=region,
            category_id=category_id,
            max_results=max_results,
        )
        return {
            "videos": videos,
            "total": len(videos),
            "region": region,
            "category_id": category_id,
        }
    except YouTubeQuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except YouTubeAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Error fetching trending videos")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/trending/regions ────────────────────────────────────────────────

@router.get("/regions")
async def get_regions():
    """Return the list of available regions with names and codes."""
    return {"regions": REGIONS}


# ── GET /api/trending/categories ─────────────────────────────────────────────

@router.get("/categories")
async def get_categories():
    """Return the list of available video categories."""
    return {"categories": CATEGORIES}
