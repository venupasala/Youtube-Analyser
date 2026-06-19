"""Analytics computation service – pure Python, no external deps.

All functions accept a list of video dicts (matching the VideoInfo schema)
and return data structures ready for the frontend charting library.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# YouTube video-category ID → human-readable name
CATEGORY_MAP: dict[str, str] = {
    "1":  "Film & Animation",
    "2":  "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "18": "Short Movies",
    "19": "Travel & Events",
    "20": "Gaming",
    "21": "Videoblogging",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
    "30": "Movies",
    "31": "Anime/Animation",
    "32": "Action/Adventure",
    "33": "Classics",
    "34": "Comedy (Film)",
    "35": "Documentary",
    "36": "Drama",
    "37": "Family",
    "38": "Foreign",
    "39": "Horror",
    "40": "Sci-Fi/Fantasy",
    "41": "Thriller",
    "42": "Shorts",
    "43": "Shows",
    "44": "Trailers",
}


def calculate_engagement_rate(videos: list[dict[str, Any]]) -> float:
    """Average engagement rate: (likes + comments) / views × 100.

    Videos with zero views are excluded from the calculation.
    """
    if not videos:
        return 0.0

    rates: list[float] = []
    for v in videos:
        views = v.get("view_count", 0)
        if views <= 0:
            continue
        likes = v.get("like_count", 0)
        comments = v.get("comment_count", 0)
        rates.append((likes + comments) / views * 100)

    return round(sum(rates) / len(rates), 2) if rates else 0.0


def get_upload_frequency(videos: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate uploads per month over the last 12 months.

    Returns ``{"labels": ["2025-07", …], "data": [3, 5, …]}``.
    """
    if not videos:
        return {"labels": [], "data": []}

    now = datetime.now(timezone.utc)
    monthly: defaultdict[str, int] = defaultdict(int)

    for v in videos:
        pub = v.get("published_at")
        if not pub:
            continue
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        # Only last 12 months
        diff_months = (now.year - dt.year) * 12 + (now.month - dt.month)
        if 0 <= diff_months < 12:
            key = dt.strftime("%Y-%m")
            monthly[key] += 1

    # Build sorted label list for last 12 months
    labels: list[str] = []
    data: list[int] = []
    for i in range(11, -1, -1):
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year}-{month:02d}"
        labels.append(key)
        data.append(monthly.get(key, 0))

    return {"labels": labels, "data": data}


def get_top_videos(
    videos: list[dict[str, Any]],
    metric: str = "view_count",
    n: int = 10,
) -> list[dict[str, Any]]:
    """Return the top *n* videos sorted by *metric* descending."""
    if not videos:
        return []

    sorted_vids = sorted(videos, key=lambda v: v.get(metric, 0), reverse=True)
    top = sorted_vids[:n]

    return [
        {
            "id": v.get("id", ""),
            "title": v.get("title", ""),
            "thumbnail_url": v.get("thumbnail_url", ""),
            "view_count": v.get("view_count", 0),
            "like_count": v.get("like_count", 0),
            "comment_count": v.get("comment_count", 0),
            "published_at": v.get("published_at", ""),
            "duration": v.get("duration", ""),
        }
        for v in top
    ]


def get_views_timeline(videos: list[dict[str, Any]]) -> dict[str, Any]:
    """Group total views by publication month.

    Returns ``{"labels": ["2025-01", …], "data": [120000, …]}``.
    """
    if not videos:
        return {"labels": [], "data": []}

    monthly: defaultdict[str, int] = defaultdict(int)

    for v in videos:
        pub = v.get("published_at")
        if not pub:
            continue
        try:
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        key = dt.strftime("%Y-%m")
        monthly[key] += v.get("view_count", 0)

    sorted_keys = sorted(monthly.keys())
    return {
        "labels": sorted_keys,
        "data": [monthly[k] for k in sorted_keys],
    }


def get_category_distribution(videos: list[dict[str, Any]]) -> dict[str, Any]:
    """Count videos by category.

    Returns ``{"labels": ["Music", "Gaming", …], "data": [12, 5, …]}``.
    """
    if not videos:
        return {"labels": [], "data": []}

    counter: Counter[str] = Counter()
    for v in videos:
        cat_id = v.get("category_id")
        if cat_id:
            name = CATEGORY_MAP.get(str(cat_id), f"Category {cat_id}")
            counter[name] += 1

    # Sort by count descending
    sorted_items = counter.most_common()
    return {
        "labels": [item[0] for item in sorted_items],
        "data": [item[1] for item in sorted_items],
    }


def get_summary_stats(videos: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute aggregate statistics across all videos."""
    if not videos:
        return {
            "avg_views": 0,
            "avg_likes": 0,
            "avg_comments": 0,
            "total_views": 0,
        }

    total_views = sum(v.get("view_count", 0) for v in videos)
    total_likes = sum(v.get("like_count", 0) for v in videos)
    total_comments = sum(v.get("comment_count", 0) for v in videos)
    n = len(videos)

    return {
        "avg_views": round(total_views / n, 2),
        "avg_likes": round(total_likes / n, 2),
        "avg_comments": round(total_comments / n, 2),
        "total_views": total_views,
    }


def compute_full_analytics(videos: list[dict[str, Any]]) -> dict[str, Any]:
    """One-call convenience: compute all analytics for a video list."""
    stats = get_summary_stats(videos)
    return {
        "engagement_rate": calculate_engagement_rate(videos),
        "avg_views": stats["avg_views"],
        "avg_likes": stats["avg_likes"],
        "avg_comments": stats["avg_comments"],
        "total_views": stats["total_views"],
        "upload_frequency": get_upload_frequency(videos),
        "top_videos": get_top_videos(videos),
        "views_timeline": get_views_timeline(videos),
        "category_distribution": get_category_distribution(videos),
    }
