# Deutschland Digital Monitor

A **read-only German regional data intelligence platform** for exploring,
comparing, ranking, and understanding official public statistics for the
Federation, the sixteen Bundesländer, and the 401 Landkreise / kreisfreie
Städte.

> **Architecture**: the deployed application is a pure **read-only** consumer of a
> **pre-computed, immutable data snapshot**. All ingestion and computation happen
> offline in the data-build stage. There is no user upload, no edit, no runtime
> ingestion, and no accounts.

## Status

- **Phase 1 — Product specification: COMPLETE** → [`docs/product-spec.md`](docs/product-spec.md)
- **Phase 2 — Repository & application foundation: COMPLETE** → this repository shape; see [`docs/architecture.md`](docs/architecture.md)
- **Phase 3+ — Data-build pipeline, API data endpoints, full UI** (roadmap)

## Repository layout

```
apps/web/        React frontend (Vite · TypeScript · Tailwind · ECharts · MapLibre GL)
backend/         FastAPI read-only backend (FastAPI · Pydantic · DuckDB read_only)
  api/           REST routes + schemas
  analytics/     analytical computations (foundation)
  insights/      insight engine (foundation)
  tests/         backend unit tests
pipeline/        offline data-build (sources/ transforms/ validation/) — Phase 3
  requirements.txt (Polars · GeoPandas)
data/            raw | processed | geography | snapshots  (gitignored)
docs/            product-spec.md · architecture.md · phase reports
tests/           cross-cutting / integration tests (later phases)
docker-compose.yml · Makefile · package.json
```

See [`docs/architecture.md`](docs/architecture.md) for the full architecture.

## Getting started

Prerequisites: Node 20+, Python 3.11+, npm.

```bash
# 1. Install
npm install
python -m venv .venv
.venv/Scripts/pip install -e "backend[dev]"        # Windows PowerShell
# .venv/bin/pip install -e "backend[dev]"          # macOS / Linux

# 2. Run the API (http://localhost:8000, docs at /docs)
npm run dev:api

# 3. Run the web app (http://localhost:5173; proxies /api to :8000)
npm run dev:web
```

Start the app in a second terminal if you haven't already:

```bash
npm run dev:web   # terminal 1
npm run dev:api   # terminal 2
```

Open http://localhost:5173 — the home page shows the app name, the seven
domains, and a small ECharts placeholder diagram; the header shows the live
backend connection status.

## Development commands

| Task | Command |
|------|---------|
| API dev server | `npm run dev:api` |
| Web dev server | `npm run dev:web` |
| Backend tests | `npm run test:api` |
| Web tests | `npm run test:web` |
| Backend lint | `npm run lint:api` |
| Web lint | `npm run lint:web` |
| Web typecheck | `npm run typecheck:web` |
| Build web | `npm run build:web` |

macOS/Linux/CI: the same tasks are exposed via `make …` (see `Makefile`).

## Snapshots

The backend reads an immutable DuckDB snapshot. Until the data-build phase
produces one, the API starts without a dataset and reports
`status: "degraded"` / `snapshot.configured: false` on `/api/health`.

Point a run at a prepared snapshot with:

```bash
export BUNDESPULSE_SNAPSHOT=data/snapshots/bundespulse.duckdb   # or set in env
```

## Running with Docker

`docker-compose.yml` + Dockerfiles are provided (api → FastAPI, web → nginx +
static build). `docker compose config` validates. Full image builds are parked
pending a later phase — the primary dev path is the commands above.

## Core domains & views

Domains: Demography · Employment · Economy · Housing · Mobility · Environment ·
Infrastructure.

Views: Explore · Region Profile · Compare · Rankings · Data Explorer ·
Relationship Explorer · Methodology/Sources.

Read the full [product specification](docs/product-spec.md) for page
responsibilities, navigation, geography, the measures taxonomy, analytical and
insight rules, transparency requirements, UX/visual principles, non-goals, and
the MVP roadmap.