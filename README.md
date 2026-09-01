# Lumière

> A personal cinematheque. Not another streaming clone — an opinionated, automated archive
> where curation, acquisition and presentation are treated as one problem.

Lumière bridges three worlds that normally don't talk to each other: canonical film
criticism (**TSPDT**), personal viewing behaviour (**Letterboxd**), and the home theatre
stack (**Jellyfin/Plex + Real-Debrid**). A headless Django backend orchestrates all of it
and serves bespoke clients — today a web app, tomorrow an Android TV app.

The interface follows a **Fine Art** design language (A24 / Criterion / MUBI): theatrical
darkness, warm film-stock whites, editorial typography, and an interface that gets out of
the way of the film.

## Table of contents

- [Status](#status)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Running locally](#running-locally)
- [Populating the archive](#populating-the-archive)
- [API surface](#api-surface)
- [Design system](#design-system)
- [Conventions](#conventions)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

## Status

The catalogue pipeline is live and populated. The ML and acquisition pipelines are
implemented but have not been run yet.

| Subsystem | State | Evidence |
| --- | --- | --- |
| Film catalogue (TSPDT + TMDB + OMDB + Wikidata) | **Live** | 25,908 films, all ranked, 25,150 with artwork |
| REST API + cookie-based JWT auth | **Live** | End to end, with silent token refresh |
| Web client | **Live** | Every route rendering against real data |
| Taste embeddings and recommender | Built, not run | 0 embeddings, 0 similarities stored |
| Acquisition (Prowlarr + Real-Debrid) | Built, not run | 0 releases stored |
| Cinema sessions and watch parties | Built, not run | 0 sessions stored |
| Playback resolution (Real-Debrid > Jellyfin > Plex) | **Live** | Chain verified end to end; no sources configured yet |
| Android TV client | **Not started** | `clients/tv/` holds only a README |

## Architecture

```text
lumiere/
├── backend/                    Django 5 — headless orchestrator and REST API
│   └── apps/
│       ├── movies/             Film catalogue, releases, quality scoring
│       ├── ingestion/          ETL from TSPDT, TMDB, OMDB, Wikidata
│       ├── integrations/       Letterboxd, Plex, Prowlarr, Real-Debrid
│       ├── ml/                 Sentence embeddings and similarity model
│       ├── user_sessions/      Cinema sessions and watch parties
│       ├── users/              Accounts, taste profile, telemetry
│       ├── notifications/      Alerts
│       ├── tasks/              Celery jobs
│       └── core/               Health checks, cache, WebSocket tickets
├── clients/
│   ├── web/                    Next.js 16 — the reference client
│   └── tv/                     Android TV (React Native) — not started
└── docker-compose.dev.yml      Postgres (pgvector) and Redis for development
```

### The four engines

**1. The Orchestrator.** Django is screen-agnostic. It serves JSON and knows nothing about
what renders it, so every client is a peer rather than a special case.

**2. The Archive.** An ETL pipeline reconciles the TSPDT canon with TMDB, OMDB and
Wikidata metadata into a single film record.

**3. The Projection Room.** Prowlarr search feeds a regex-based quality scoring algorithm
that prioritises REMUX, Dolby Vision/HDR and lossless audio, then hands off to Real-Debrid
for instant-availability checks and cached streaming.

**4. The Neural Core.** Letterboxd history becomes a user embedding via
`sentence-transformers/all-MiniLM-L6-v2`, and pgvector cosine similarity powers
content-based recommendations.

### Playback resolution

`GET /api/movies/{id}/playback/` answers one question: where does this film
actually play? It walks three sources in a fixed order and returns the first
that has it.

1. **Real-Debrid** — a release from the archive already cached there. Highest
   fidelity (the quality scorer favours REMUX/HDR/Atmos) and it does not need
   the home server to be awake.
2. **Jellyfin** — the local library.
3. **Plex** — the legacy library.

Each step is isolated: a Jellyfin that is down cannot stop the fall through to
Plex. A step with no credentials configured is skipped rather than attempted.
When no source has the film the endpoint answers `404`, and the player says so
instead of pretending to play something.

Credentials live per user, following the existing Plex pattern:
`jellyfin_server_url`, `jellyfin_token`, `jellyfin_user_id` on the user record.
Real-Debrid falls back to the global `REAL_DEBRID_API_KEY` when the user has
none of their own.

The order is business logic, not an implementation detail — it is asserted in
`backend/apps/movies/test_playback.py` so a reorder fails the suite.

### Authentication

Tokens never touch JavaScript. The browser holds only `HttpOnly` cookies, and the Next.js
route handlers act as a Backend-for-Frontend:

1. The browser posts credentials to `POST /api/auth/login` — a **Next** route handler, not
   Django.
2. That handler forwards them to Django's `POST /api/auth/token/` and stores the returned
   pair as `HttpOnly` cookies.
3. Data requests go straight to Django. Its `CookieJWTAuthentication` class reads the JWT
   out of the `access_token` cookie instead of an `Authorization` header.
4. On a `401`, the HTTP client calls `POST /api/auth/refresh` — again a Next handler, so
   the refresh token never leaves the server — and retries the original request once.
   Concurrent requests share a single refresh, because Django rotates refresh tokens and
   parallel rotations would invalidate each other.

Cookie lifetime is derived from the JWT's own `exp` claim, so changing `SIMPLE_JWT` in
Django needs no frontend change.

## Tech stack

**Backend**

- Django 5, Django REST Framework, SimpleJWT, drf-spectacular
- Celery and Channels, both backed by Redis
- PostgreSQL 15 with the pgvector extension
- sentence-transformers, Prometheus

**Web**

- Next.js 16 (App Router, Turbopack), React 19, TypeScript in strict mode
- Tailwind CSS v4, Framer Motion 12, Lucide
- TanStack Query for server state, Zustand for client state

## Running locally

### Prerequisites

| Tool | Version used | Notes |
| --- | --- | --- |
| Python | 3.12 | |
| Node.js | 20.9+ (22 in use) | Required by Next.js 16 |
| PostgreSQL | 15 | Must have the `pgvector` extension |
| Redis | 7 | Cache, Celery broker, Channels layer |

### 1. Start Postgres and Redis

The compose file provisions both, already including pgvector:

```bash
docker compose -f docker-compose.dev.yml up -d
```

It creates the database `lumiere_db` with user `lumiere` and password `password` on port
`5432`, plus Redis on `6379`. If you already run Postgres and Redis natively, skip this
and point the `.env` at your own instances instead.

Verify they are up:

```bash
pg_isready -h localhost -p 5432
redis-cli ping     # expects: PONG
```

### 2. Configure the backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Create `backend/.env`. These values match the compose file above:

```ini
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000

DB_NAME=lumiere_db
DB_USER=lumiere
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
DATABASE_URL=postgresql://lumiere:password@localhost:5432/lumiere_db

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

TMDB_API_KEY=
OMDB_API_KEY=
REAL_DEBRID_API_KEY=
```

`CORS_ALLOWED_ORIGINS` must include the web client's origin, otherwise every request from
the browser fails — the API relies on credentialed cross-origin cookies.

### 3. Migrate and run

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Check it answers:

```bash
curl http://localhost:8000/api/health/
```

Interactive API docs live at <http://localhost:8000/api/docs/>.

### 4. Run the web client

```bash
cd clients/web
npm install
npm run dev
```

Create `clients/web/.env.local` only if your API is not on the default host:

```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open <http://localhost:3000>. Every route except `/login` is gated by `proxy.ts`, which
redirects to the login page when the `access_token` cookie is absent — so sign in with the
superuser you just created.

### 5. Optional background workers

Only needed for the acquisition and ML pipelines:

```bash
cd backend
celery -A lumiere worker -l info
celery -A lumiere beat -l info
```

## Populating the archive

Run in this order — later steps enrich what earlier ones create:

```bash
cd backend
python manage.py load_tspdt            # the ranked canon
python manage.py sync_tmdb             # artwork, cast, crew, overviews
python manage.py sync_omdb             # external ratings
python manage.py sync_wikidata         # awards and festivals
python manage.py generate_embbedings   # taste vectors (name is misspelled in the repo)
```

`sync_tmdb` and `sync_omdb` need their API keys in `.env` and are rate-limited, so a full
run over ~26k films takes hours.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health/` | Liveness probe |
| `GET /api/movies/` | Paginated catalogue; filters for search, genres, decades, qualities |
| `GET /api/movies/{id}/` | Full film record — cached in Redis for one hour |
| `GET /api/movies/top_rated/` | Highest-ranked films |
| `GET /api/movies/{id}/playback/` | Resolve where to play — Real-Debrid, then Jellyfin, then Plex |
| `POST /api/movies/{id}/search_torrents/` | Prowlarr search plus quality scoring |
| `/api/releases/`, `/api/sessions/`, `/api/themes/`, `/api/users/` | Resource routers |
| `POST /api/auth/token/`, `/refresh/`, `/verify/` | JWT lifecycle |
| `GET /api/profile/telemetry/` | Viewing analytics |
| `GET /api/schema/`, `/api/docs/` | OpenAPI schema and Swagger UI |
| `GET /metrics/` | Prometheus |

## Design system

The palette is declared once, in `:root` inside
[`clients/web/app/globals.css`](clients/web/app/globals.css) — deliberately **not** inside
Tailwind's `@theme`. Tailwind v4 tree-shakes theme tokens that no utility class consumes
(measured: only 8 of 23 survived a build), and this codebase writes colour mostly through
inline `style`, where a dropped variable silently resolves to nothing.

| Group | Tokens | Role |
| --- | --- | --- |
| Surfaces | `--void` `#040402`, `--bg` `#080806`, `--s1`–`--s5` | Backgrounds and elevation |
| Text | `--film` `#EDE8DC`, `--m1`–`--m5` | Warm greyscale, lightest to darkest |
| Accent | `--gold` `#BF8F3C` | The only warm colour in the system |
| Quality | `--sage`, `--terra`, `--violet`, `--steel`, `--teal` | REMUX, HDR, ATMOS, Dolby Vision, IMAX |

Typography is **Cormorant Garamond** for titles, **DM Sans** for interface copy and
**DM Mono** for technical data. Only the weights actually loaded in `app/layout.tsx` are
used — asking for any other makes the browser synthesise it, which looks wrong.

`lib/design-tokens.ts` mirrors the palette as plain TypeScript, because React Native
cannot read CSS variables and the TV client will need the same values as data.

## Conventions

```bash
npm run dev            # Next dev server
npm run build          # production build; also runs the type checker
npm run lint           # ESLint
npm run gen:api        # regenerate types/api-generated.ts from the live OpenAPI schema
npm run check:tokens   # fail if the TypeScript palette drifts from globals.css
```

- **Never hand-write API types.** They are generated from Django's schema. The one
  exception is Django `JSONField`s, which drf-spectacular can only type as `unknown`;
  those are refined in `features/movies/types.ts` and flagged there.
- **Keep business logic out of the DOM.** Data hooks, formatting and rules live under
  `features/` so the Android TV client can reuse them unchanged.
- **Colours go through tokens** (`var(--gold)`), never raw hex.
- `npm run gen:api` needs the Django server running, since it reads the live schema.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Film detail returns fields you just removed from a serializer | `retrieve()` caches responses in Redis for one hour | `python manage.py shell -c "from django.core.cache import cache; cache.clear()"` |
| Every API call returns `401` | Missing or stale `access_token` cookie, or `CORS_ALLOWED_ORIGINS` does not list the client origin | Sign in again; confirm the origin in `backend/.env` |
| Browser blocks API calls as cross-origin | `CORS_ALLOW_CREDENTIALS` is on but the origin is not allowed | Add `http://localhost:3000` to `CORS_ALLOWED_ORIGINS` |
| `next build` fails with `useSearchParams() should be wrapped in a suspense boundary` | A client component reads search params without a `<Suspense>` parent | Wrap the component, as `app/player/page.tsx` does |
| Dev server returns `Internal Server Error` on every route | `.next/` was deleted while the dev server was running | Stop it, then `rm -rf .next` and restart |
| Django behaves like an older version | The virtualenv drifted from `requirements.txt` | `pip install -r backend/requirements.txt` |
| `npm run gen:api` fails | The Django server is not running | Start it, then rerun |

## Roadmap

- **Acquisition online** — run the Prowlarr and Real-Debrid pipeline for real
- **Neural core online** — generate embeddings and populate the similarity model
- **Player** — real stream URLs from Jellyfin and resumable session progress
- **Android TV client** — Expo and React Native with `react-native-video` (ExoPlayer),
  D-pad spatial navigation, and aggressive memory discipline for low-RAM sets
