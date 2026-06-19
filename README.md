# 📺 YouTube Account Analyzer

A professional, full-stack YouTube channel analytics platform with full-text search, semantic/vector search, trending video discovery, and a stunning dark-themed dashboard — all deployed via Docker.

![Built with](https://img.shields.io/badge/Built%20with-FastAPI-009688?style=flat-square)
![Search](https://img.shields.io/badge/Search-Elasticsearch-005571?style=flat-square)
![Vectors](https://img.shields.io/badge/Vectors-ChromaDB-7C3AED?style=flat-square)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Channel Analytics** | Deep-dive into any YouTube channel — subscribers, views, engagement rate, upload frequency |
| 🔍 **Full-Text Search** | Search indexed videos with Elasticsearch (BM25 ranking) |
| 🧠 **Semantic Search** | Find similar videos using AI embeddings (ChromaDB + Sentence Transformers) |
| 🔥 **Trending Videos** | Today's trending videos by region and category |
| 📈 **Visual Charts** | Interactive Chart.js visualizations — views timeline, top videos, categories |
| 🐳 **One-Command Deploy** | Everything runs in Docker — no manual setup needed |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                Docker Compose                    │
│                                                  │
│  ┌──────────┐    ┌──────────────┐               │
│  │  Nginx   │───▶│   FastAPI    │               │
│  │  :80     │    │   :8080      │               │
│  │ (frontend│    │  (backend)   │               │
│  │ + proxy) │    │              │               │
│  └──────────┘    └──┬───────┬──┘               │
│                     │       │                    │
│           ┌─────────▼──┐ ┌──▼──────────┐       │
│           │Elasticsearch│ │  ChromaDB   │       │
│           │   :9200     │ │   :8000     │       │
│           │(full-text)  │ │  (vectors)  │       │
│           └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │ YouTube Data   │
              │   API v3       │
              └────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** installed and running ([Download](https://www.docker.com/products/docker-desktop/))
- **YouTube Data API v3 key** ([Get one here](https://console.cloud.google.com/apis/credentials))
- At least **4GB RAM** allocated to Docker

### Setup

```bash
# 1. Clone or navigate to the project
cd youtube-analyzer

# 2. Create your environment file
cp .env.example .env

# 3. Edit .env and add your YouTube API key
#    YOUTUBE_API_KEY=AIza...your_key_here

# 4. Build and start everything
docker-compose up --build -d

# 5. Wait ~60 seconds for Elasticsearch to initialize

# 6. Open in browser
#    http://localhost
```

### Verify Services

```bash
# Check all containers are running
docker-compose ps

# Check backend health
curl http://localhost/api/health

# View logs
docker-compose logs -f backend
```

### Stop

```bash
docker-compose down          # Stop containers (data preserved)
docker-compose down -v       # Stop + delete all data
```

---

## 📖 Usage

### 1. Analyze a Channel
- Enter a YouTube channel URL, @handle, or channel ID in the search bar
- Examples: `@mkbhd`, `https://youtube.com/@veritasium`, `UC_x5XG1OV2P6uZZ5FSM9Ttw`
- View subscriber count, total views, engagement rate, and charts

### 2. Search Videos
- **Full-Text Search**: Searches videos indexed in Elasticsearch (from analyzed channels)
- **Semantic Search**: Uses AI embeddings to find conceptually similar videos
- **YouTube Search**: Searches YouTube directly (uses API quota)

### 3. Trending Videos
- Select a region (US, India, UK, etc.)
- Filter by category (Music, Gaming, Sports, etc.)
- See today's most popular videos

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `YOUTUBE_API_KEY` | — | Your YouTube Data API v3 key (required) |
| `DEFAULT_REGION` | `US` | Default region for trending videos |
| `ES_JAVA_OPTS` | `-Xms512m -Xmx512m` | Elasticsearch JVM heap size |

---

## 📊 API Quota Usage

YouTube API has a **10,000 units/day** limit. Here's what each action costs:

| Action | Quota Cost |
|--------|-----------|
| Analyze a channel | ~3-5 units |
| Get trending videos | 1 unit |
| YouTube search | 100 units ⚠️ |
| Video details (batch 50) | 1 unit |

**Tip**: Use Full-Text or Semantic search (free, uses local indexes) instead of YouTube search whenever possible.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Chart.js |
| Backend | Python, FastAPI, Uvicorn |
| Search | Elasticsearch 8.x |
| Vectors | ChromaDB, Sentence Transformers |
| Proxy | Nginx |
| Deploy | Docker, Docker Compose |

---

## 📁 Project Structure

```
youtube-analyzer/
├── docker-compose.yml          # Service orchestration
├── .env.example                # Environment template
├── nginx/
│   └── nginx.conf              # Reverse proxy config
├── backend/
│   ├── Dockerfile              # Python container
│   ├── requirements.txt        # Dependencies
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Settings
│   ├── models/
│   │   └── schemas.py          # Pydantic models
│   ├── services/
│   │   ├── youtube_service.py  # YouTube API client
│   │   ├── elasticsearch_service.py
│   │   ├── vector_service.py   # ChromaDB + embeddings
│   │   └── analytics_service.py
│   └── routes/
│       ├── channel.py          # Channel endpoints
│       ├── search.py           # Search endpoints
│       └── trending.py         # Trending endpoints
└── frontend/
    ├── index.html              # SPA shell
    ├── css/styles.css          # Design system
    └── js/
        ├── app.js              # Router
        ├── api.js              # API client
        ├── views/              # Page views
        └── components/         # Reusable UI
```

---

## 📝 License

MIT License — feel free to use and modify.
"# Youtube-Analyser" 
