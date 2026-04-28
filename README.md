# Lumière.
> The ultimate AI-powered personal cinema platform. Where world-class curation meets machine learning, automated high-fidelity retrieval, and editorial design.

![Lumière Hero Image](link-to-your-hero-image-or-gif)

## 🎬 The Manifesto

**Lumière** is not another streaming clone. It is a highly opinionated, automated personal cinemateque. Built for cinephiles who demand the highest audio-visual fidelity (4K Remux, Dolby Atmos) and intelligent curation. 

It bridges the gap between static lists (TSPDT), behavioral viewing history (Letterboxd), and the physical home theater ecosystem (Plex + Real-Debrid), all wrapped in a TV-first, "Fine Art" editorial user interface.

---

## 🧠 Core Architecture & Systems

Lumière is a full-stack orchestration of four distinct engines working in harmony.

### 1. The Neural Core (Machine Learning)
Lumière doesn't just recommend movies; it understands *why* you like them.
* **Taste Profiling:** Scrapes Letterboxd viewing history to generate a 768-dimensional user embedding via `sentence-transformers/all-MiniLM-L6-v2`.
* **Hybrid Recommender:** Combines Content-Based filtering (pgvector cosine similarity), Collaborative filtering, and Behavioral Pattern detection (e.g., Arthouse preference, Subtitle affinity).
* **AI Session Generator:** Uses natural language processing to curate themed film sessions (e.g., *"melancholic autumn evening films"*).

### 2. The Projection Room (Automation & Retrieval)
A zero-touch pipeline for acquiring the highest quality cinematic releases.
* **Quality Scoring Engine:** Custom Prowlarr integration with a strict regex-based scoring algorithm prioritizing REMUX, HDR/Dolby Vision, and lossless audio (Atmos/TrueHD).
* **Cloud Orchestration:** Deep Real-Debrid API integration for instant-availability checks, cached torrent streaming, and automated background downloading.
* **The Library (Plex):** Bi-directional sync with Plex Media Server to monitor watch states, extract media info, and trigger library updates.

### 3. The Canvas (TV-First Frontend)
A "Lithographic UI" inspired by classic cinema programmes and editorial design.
* **Spatial Navigation:** Custom `useTVNavigation` hook managing 10-foot UI constraints, D-pad focus management, and fluid layout morphing.
* **Kinetic Typography:** Strict contrast between elegant serif headers (`Cormorant Garamond`) and mechanical monospace metadata (`DM Mono`).
* **Optical Polish:** GPU-accelerated framer-motion animations, simulated projector flicker, and depth-of-field blurring to guide user focus.

---

## ⚙️ Technology Stack

**Frontend (The Canvas)**
* **Framework:** Next.js 14+ (App Router, RSC)
* **Language:** TypeScript 5.4+
* **State & Data:** Zustand (Client) + TanStack Query v5 (Server)
* **Motion & UI:** Framer Motion 11, Tailwind CSS, shadcn/ui

**Backend (The Engine)**
* **Framework:** FastAPI (Python 3.11+)
* **Database:** PostgreSQL 15+ with `pgvector`
* **ORM:** SQLAlchemy 2.0 (Async)
* **Machine Learning:** PyTorch, scikit-learn, sentence-transformers
* **Task Queue:** Celery + Redis

**Infrastructure & DevOps**
* **Deployment:** Docker & Docker Compose
* **Proxy & SSL:** Traefik 3.0 with Let's Encrypt
* **Monitoring:** Prometheus, Grafana, Loki

---

## 🗄️ Database Schema & Vector Search

The backbone of Lumière is a highly relational PostgreSQL database optimized for vector similarity search.

* **`movies`**: Enriched with TSPDT rankings, TMDB metadata, and 768-dim embeddings. Full-text search enabled via GIN indexes.
* **`user_taste_profiles`**: Stores behavioral configurations and calculated quality sensitivities.
* **`cinema_sessions`**: Manages the state machine of a planned viewing (planning → preparing → ready → completed), tracking asynchronous download statuses.
* **`torrent_releases`**: Logs and scores Prowlarr indices based on complex audio/video bitrates and release groups.

---

## 🚀 Getting Started (Production Deployment)

Lumière is containerized for seamless deployment via Docker Compose.

```bash
# Clone the repository
git clone [https://github.com/your-username/lumiere.git](https://github.com/your-username/lumiere.git)
cd lumiere

# Configure environment variables
cp .env.example .env.production

# Boot the orchestrator (Traefik, Postgres, Redis, Celery, FastAPI, Next.js)
docker compose -f docker-compose.prod.yml up -d