"""FastAPI application entry-point for the YouTube Account Analyzer backend.

Manages the application lifespan (startup / shutdown) and wires together
all routes and services.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from models.schemas import HealthResponse
from services.elasticsearch_service import ElasticsearchService
from services.vector_service import VectorService
from services import youtube_service

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Singleton service instances (populated during lifespan startup) ───────────

es_service: ElasticsearchService | None = None
vector_service: VectorService | None = None


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle manager.

    On startup:
      1. Wait for Elasticsearch to become ready (retry loop).
      2. Create ES index.
      3. Initialise ChromaDB collection.
      4. Pre-load the sentence-transformer embedding model.

    On shutdown:
      1. Close the Elasticsearch transport.
      2. Close the shared httpx client used by the YouTube service.
    """
    global es_service, vector_service

    logger.info("=" * 60)
    logger.info("YouTube Analyzer Backend – starting up")
    logger.info("=" * 60)

    # ── Elasticsearch ─────────────────────────────────────────────────
    es_service = ElasticsearchService(settings.ELASTICSEARCH_URL)

    es_ready = False
    for attempt in range(1, 31):  # up to 30 retries (~60 s)
        try:
            healthy = await es_service.is_healthy()
            if healthy:
                logger.info("Elasticsearch is ready (attempt %d)", attempt)
                es_ready = True
                break
        except Exception:
            pass
        logger.info("Waiting for Elasticsearch … (attempt %d/30)", attempt)
        await asyncio.sleep(2)

    if es_ready:
        try:
            await es_service.create_index()
        except Exception as e:
            logger.error("Failed to create ES index: %s", e)
    else:
        logger.warning("Elasticsearch not available – full-text search disabled")

    # ── ChromaDB + Embedding model ────────────────────────────────────
    try:
        vector_service = VectorService(
            host=settings.CHROMADB_HOST,
            port=settings.CHROMADB_PORT,
            model_name=settings.EMBEDDING_MODEL,
        )
        vector_service.load_model()
        vector_service.init_collection()
        logger.info("ChromaDB + embedding model ready")
    except Exception as e:
        logger.error("Failed to initialise vector service: %s", e)
        vector_service = None

    logger.info("Startup complete ✔")

    yield  # ── application runs here ──

    # ── Shutdown ──────────────────────────────────────────────────────
    logger.info("Shutting down …")

    if es_service:
        try:
            await es_service.close()
        except Exception:
            pass

    await youtube_service.close_client()

    logger.info("Shutdown complete ✔")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="YouTube Account Analyzer API",
    description="Backend for analyzing YouTube channels, videos, and trends.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow everything during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ─────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions → 500 JSON response."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
    )


# ── Health endpoint ───────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Return overall health status of the backend and its dependencies."""
    es_ok = False
    chroma_ok = False

    if es_service:
        try:
            es_ok = await es_service.is_healthy()
        except Exception:
            pass

    if vector_service:
        try:
            chroma_ok = vector_service.is_healthy()
        except Exception:
            pass

    overall = "ok" if (es_ok and chroma_ok) else "degraded"

    return HealthResponse(
        status=overall,
        elasticsearch=es_ok,
        chromadb=chroma_ok,
        version="1.0.0",
    )


# ── Register routers ─────────────────────────────────────────────────────────

from routes.channel import router as channel_router
from routes.search import router as search_router
from routes.trending import router as trending_router

app.include_router(channel_router)
app.include_router(search_router)
app.include_router(trending_router)


# ── Serve Frontend Static Files ───────────────────────────────────────────────
# Mount the frontend directory LAST so API routes always take priority.
# StaticFiles with html=True serves index.html as the fallback for SPA routing.

from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Resolve the frontend directory (../frontend relative to this file)
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if _FRONTEND_DIR.exists():
    # Mount entire frontend as a static app at root — MUST be last!
    # html=True means it serves index.html for directory requests (SPA fallback)
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
    logger.info("Frontend served from %s", _FRONTEND_DIR)
else:
    logger.warning("Frontend directory not found at %s", _FRONTEND_DIR)

    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "YouTube Analyzer API", "docs": "/docs", "health": "/api/health"}


