Lumière.

    The ultimate AI-powered personal cinema platform. Where world-class curation meets machine learning, automated high-fidelity retrieval, and editorial design.

🎬 The Manifesto

Lumière is not another streaming clone. It is a highly opinionated, automated personal cinemateque. Built for cinephiles who demand the highest audio-visual fidelity (4K REMUX, Dolby Vision, TrueHD Atmos) and intelligent curation.

It bridges the gap between static lists (TSPDT), behavioral viewing history (Letterboxd), and the physical home theater ecosystem (Jellyfin/Plex + Real-Debrid), all orchestrated by a Headless Django backend serving multiple bespoke clients.
🧠 Core Architecture & Systems

Lumière is a full-stack orchestration of four distinct engines working in harmony.
1. The Headless Orchestrator (Backend)

Lumière's brain is agnostic. It processes data and serves APIs, unaware of what screen is rendering it.

    Taste Profiling: Scrapes Letterboxd viewing history to generate user embeddings via sentence-transformers/all-MiniLM-L6-v2.

    Telemetry Engine: Custom mathematical aggregations (via PostgreSQL) generating real-time analytics on viewing habits, directors, genres, and geographic distributions.

    The Library (Jellyfin/Plex): Bi-directional sync with local media servers to monitor watch states, extract media info, and trigger direct-play streaming.

2. The Projection Room (Automation & Retrieval)

A zero-touch pipeline for acquiring the highest quality cinematic releases.

    Quality Scoring Engine: Custom Prowlarr integration with a strict regex-based scoring algorithm prioritizing REMUX, HDR/Dolby Vision, and lossless audio.

    Cloud Orchestration: Deep Real-Debrid API integration for instant-availability checks, cached torrent streaming, and automated background downloading.

3. The Trinity of Streaming (Playback Architecture)

Lumière adapts its playback strategy based on the hardware it is running on, ensuring zero bottlenecks:

    The Web Canvas (HTML5): Fallback player for browsers (Laptops/Tablets) with custom React UI, handling Web-DLs and HDR10.

    Smart Handoff (Local Engine): Deep-links directly to native Jellyfin/Plex apps on Android TV to bypass browser restrictions and utilize hardware decoders.

    The Purist Cast (Direct Play): Extracts raw Real-Debrid URLs and casts them via API to external enthusiast hardware (Nvidia Shield/Kodi) for uncompressed Dolby Vision Profile 7 and Passthrough Lossless Audio.

4. The Canvas (Multi-Client Frontend)

A "Lithographic UI" inspired by classic cinema programmes and editorial design, split into a Monorepo.

    clients/web: A dashboard and curation portal built in Next.js. Features True Glassmorphism, kinetic typography (Cormorant Garamond + DM Mono), and complex data visualization.

    clients/tv: A 10-foot UI native Android TV application. Built to interface directly with hardware decoders (ExoPlayer) for uncompromised playback fluidity.

⚙️ Technology Stack

Frontend (The Canvas - Monorepo)

    Web Client: Next.js 14+ (App Router), TypeScript, Framer Motion 11, Tailwind CSS.

    TV Client: Kotlin, Jetpack Compose for TV, ExoPlayer (Android Native).

    State & Data: Zustand + TanStack Query v5.

Backend (The Engine)

    Framework: Django 5.0+ & Django Rest Framework (DRF)

    Database: PostgreSQL 15+ with pgvector

    Machine Learning: PyTorch, scikit-learn, sentence-transformers

    Task Queue: Celery + Redis

Infrastructure & DevOps

    Deployment: Docker & Docker Compose

    Proxy & SSL: Traefik 3.0 with Let's Encrypt

🗄️ Monorepo Structure
Plaintext

lumiere/
│
├── backend/                  # The Brain (Django, Celery, Postgres)
│   ├── config/               # Settings, Routing
│   └── apps/                 # users, movies, tasks, integrations
│
├── clients/                  # The Interfaces
│   │
│   ├── web/                  # Lumiere Web (Next.js - Curation & Admin)
│   │   ├── app/
│   │   └── components/
│   │
│   └── tv/                   # Lumiere Android TV (Kotlin - Living Room)
│       └── src/main/java/
│
└── docker-compose.yml

🚀 Getting Started (Development)

Lumière relies on a local environment setup via Docker for its services.
Bash

# Clone the repository
git clone https://github.com/your-username/lumiere.git
cd lumiere

# 1. Boot the Backend Services (Postgres, Redis)
docker compose -f docker-compose.dev.yml up -d db redis

# 2. Start the Django Headless Server
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver

# 3. Start the Web Client
cd ../clients/web
npm install
npm run dev