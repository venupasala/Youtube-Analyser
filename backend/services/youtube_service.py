"""Async YouTube Data API v3 client.

Uses httpx for all HTTP calls.  Implements the efficient playlist-based
approach for fetching channel videos (1 quota-unit per page instead of 100).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional
from urllib.parse import urlparse, parse_qs

import httpx

from config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://www.googleapis.com/youtube/v3"

# Reusable async client – created once, closed on shutdown
_http_client: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


async def close_client() -> None:
    """Close the shared httpx client (call on app shutdown)."""
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_duration(iso_duration: str | None) -> tuple[str, int]:
    """Convert ISO 8601 duration (PT4M13S) → (human string, total seconds).

    Returns ("0:00", 0) for unparseable / None input.
    """
    if not iso_duration:
        return "0:00", 0

    pattern = re.compile(
        r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"
    )
    m = pattern.match(iso_duration)
    if not m:
        return "0:00", 0

    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    seconds = int(m.group(3) or 0)
    total = hours * 3600 + minutes * 60 + seconds

    if hours:
        human = f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        human = f"{minutes}:{seconds:02d}"
    return human, total


def parse_channel_input(query: str) -> dict[str, str]:
    """Detect whether *query* is a URL, @handle, or bare channel ID.

    Returns dict with key ``type`` (one of 'id', 'handle', 'username', 'custom_url')
    and key ``value``.
    """
    query = query.strip()

    # Direct channel ID (UC...)
    if re.match(r"^UC[\w-]{22}$", query):
        return {"type": "id", "value": query}

    # @handle
    if query.startswith("@"):
        return {"type": "handle", "value": query}

    # URL patterns
    if "youtube.com" in query or "youtu.be" in query:
        parsed = urlparse(query if query.startswith("http") else f"https://{query}")
        path = parsed.path.rstrip("/")

        # /channel/UC...
        m = re.search(r"/channel/(UC[\w-]{22})", path)
        if m:
            return {"type": "id", "value": m.group(1)}

        # /@handle
        m = re.search(r"/@([\w.-]+)", path)
        if m:
            return {"type": "handle", "value": f"@{m.group(1)}"}

        # /c/CustomName  or  /user/Username
        m = re.search(r"/(?:c|user)/([\w.-]+)", path)
        if m:
            return {"type": "username", "value": m.group(1)}

        # /CustomName (legacy vanity URL)
        if path and path != "/":
            slug = path.lstrip("/")
            if slug:
                return {"type": "handle", "value": f"@{slug}"}

    # Fallback – treat as search term / handle
    return {"type": "handle", "value": query if query.startswith("@") else f"@{query}"}


async def _api_get(endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
    """Fire a GET request to the YouTube Data API and return JSON."""
    params["key"] = settings.YOUTUBE_API_KEY
    url = f"{BASE_URL}/{endpoint}"
    logger.debug("YouTube API → %s  params=%s", endpoint, {k: v for k, v in params.items() if k != "key"})

    resp = await _client().get(url, params=params)

    if resp.status_code == 403:
        body = resp.json()
        errors = body.get("error", {}).get("errors", [])
        if any(e.get("reason") == "quotaExceeded" for e in errors):
            raise YouTubeQuotaExceeded("YouTube API daily quota exceeded")
        raise YouTubeAPIError(f"Forbidden: {body}")

    if resp.status_code != 200:
        raise YouTubeAPIError(
            f"YouTube API returned {resp.status_code}: {resp.text[:500]}"
        )

    return resp.json()


# ── Exceptions ────────────────────────────────────────────────────────────────

class YouTubeAPIError(Exception):
    """Generic YouTube API error."""


class YouTubeQuotaExceeded(YouTubeAPIError):
    """Raised when the daily quota has been exceeded."""


class ChannelNotFound(YouTubeAPIError):
    """Raised when a channel cannot be resolved."""


# ── Public API ────────────────────────────────────────────────────────────────

async def resolve_channel(query: str) -> str:
    """Resolve an arbitrary user query to a YouTube channel ID.

    Supports @handles, channel URLs, /c/ custom URLs, and bare IDs.
    Returns a channel ID string (``UC...``).
    """
    parsed = parse_channel_input(query)

    if parsed["type"] == "id":
        return parsed["value"]

    # For handles & usernames, use search.list with type=channel
    search_query = parsed["value"]
    data = await _api_get("search", {
        "part": "snippet",
        "q": search_query,
        "type": "channel",
        "maxResults": 1,
    })

    items = data.get("items", [])
    if not items:
        raise ChannelNotFound(f"No channel found for query: {query}")

    channel_id = items[0]["snippet"]["channelId"]
    logger.info("Resolved '%s' → %s", query, channel_id)
    return channel_id


async def get_channel_info(channel_id: str) -> dict[str, Any]:
    """Fetch full channel metadata and statistics."""
    data = await _api_get("channels", {
        "part": "snippet,statistics,contentDetails,brandingSettings",
        "id": channel_id,
    })

    items = data.get("items", [])
    if not items:
        raise ChannelNotFound(f"Channel not found: {channel_id}")

    item = items[0]
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    content = item.get("contentDetails", {})

    thumbnails = snippet.get("thumbnails", {})
    thumb = (
        thumbnails.get("high", {}).get("url")
        or thumbnails.get("medium", {}).get("url")
        or thumbnails.get("default", {}).get("url")
        or ""
    )

    return {
        "id": item["id"],
        "title": snippet.get("title", ""),
        "description": snippet.get("description", ""),
        "custom_url": snippet.get("customUrl"),
        "published_at": snippet.get("publishedAt"),
        "country": snippet.get("country"),
        "thumbnail_url": thumb,
        "subscriber_count": int(stats.get("subscriberCount", 0)),
        "view_count": int(stats.get("viewCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
        "uploads_playlist_id": content.get("relatedPlaylists", {}).get("uploads"),
    }


async def get_channel_videos(
    channel_id: str,
    max_results: int = 50,
) -> list[dict[str, Any]]:
    """Fetch recent videos for a channel using the efficient playlist approach.

    1. Get the uploads playlist ID from the channel resource.
    2. Page through ``playlistItems.list`` (1 quota-unit per page).
    3. Batch ``videos.list`` to get full stats (1 unit per 50 videos).
    """
    # Step 1 – uploads playlist
    channel = await get_channel_info(channel_id)
    playlist_id = channel.get("uploads_playlist_id")
    if not playlist_id:
        logger.warning("No uploads playlist for channel %s", channel_id)
        return []

    # Step 2 – collect video IDs from playlistItems
    video_ids: list[str] = []
    next_page: str | None = None

    while len(video_ids) < max_results:
        params: dict[str, Any] = {
            "part": "contentDetails",
            "playlistId": playlist_id,
            "maxResults": min(50, max_results - len(video_ids)),
        }
        if next_page:
            params["pageToken"] = next_page

        data = await _api_get("playlistItems", params)
        for item in data.get("items", []):
            vid = item.get("contentDetails", {}).get("videoId")
            if vid:
                video_ids.append(vid)

        next_page = data.get("nextPageToken")
        if not next_page:
            break

    if not video_ids:
        return []

    # Step 3 – batch fetch full details
    return await get_video_details(video_ids)


async def get_video_details(video_ids: list[str]) -> list[dict[str, Any]]:
    """Batch-fetch video details (max 50 per call)."""
    results: list[dict[str, Any]] = []

    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        data = await _api_get("videos", {
            "part": "snippet,statistics,contentDetails",
            "id": ",".join(batch),
        })
        for item in data.get("items", []):
            results.append(_parse_video_item(item))

    return results


async def search_videos(
    query: str,
    max_results: int = 20,
) -> list[dict[str, Any]]:
    """Search YouTube videos (costs 100 quota units per call)."""
    data = await _api_get("search", {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": min(max_results, 50),
        "order": "relevance",
    })

    video_ids = [
        item["id"]["videoId"]
        for item in data.get("items", [])
        if item.get("id", {}).get("videoId")
    ]

    if not video_ids:
        return []

    return await get_video_details(video_ids)


async def get_trending_videos(
    region: str = "US",
    category_id: Optional[str] = None,
    max_results: int = 25,
) -> list[dict[str, Any]]:
    """Fetch currently trending (most popular) videos."""
    params: dict[str, Any] = {
        "part": "snippet,statistics,contentDetails",
        "chart": "mostPopular",
        "regionCode": region,
        "maxResults": min(max_results, 50),
    }
    if category_id:
        params["videoCategoryId"] = category_id

    data = await _api_get("videos", params)
    return [_parse_video_item(item) for item in data.get("items", [])]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _parse_video_item(item: dict[str, Any]) -> dict[str, Any]:
    """Normalise a single ``videos.list`` item into our schema shape."""
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    content = item.get("contentDetails", {})

    thumbnails = snippet.get("thumbnails", {})
    thumb = (
        thumbnails.get("high", {}).get("url")
        or thumbnails.get("medium", {}).get("url")
        or thumbnails.get("default", {}).get("url")
        or ""
    )

    duration_human, duration_secs = parse_duration(content.get("duration"))

    return {
        "id": item["id"],
        "title": snippet.get("title", ""),
        "description": snippet.get("description", ""),
        "channel_id": snippet.get("channelId", ""),
        "channel_title": snippet.get("channelTitle", ""),
        "published_at": snippet.get("publishedAt"),
        "thumbnail_url": thumb,
        "duration": duration_human,
        "duration_seconds": duration_secs,
        "view_count": int(stats.get("viewCount", 0)),
        "like_count": int(stats.get("likeCount", 0)),
        "comment_count": int(stats.get("commentCount", 0)),
        "tags": snippet.get("tags", []),
        "category_id": snippet.get("categoryId"),
    }
