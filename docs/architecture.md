# BundesPulse — Repository & Application Architecture

**Phase:** 2 — repository and application foundation.
**Model:** immutable/precomputed-data → read-only API → read-only web app.

---

## 1. System overview

The product is split into two conceptual systems that are deliberately kept
apart:

1. **Offline data preparation** (`pipeline/`, Phase 3) — takes government data
   and produces a prepared, immutable snapshot.
2. **Production application** (`backend/` + `apps/web`) — a read-only FastAPI
   service and a read-only React frontend over that snapshot.

The production application **never** ingests external APIs, never writes data,
and has no authentication.

```
   official sources (Destatis, BA, BKG, UBA, BNetzA, GovData)
        │  [offline]
        ▼
   pipeline/  (extract → transform → validate)      [Phase 3]
        │
        ▼
   data/snapshots/bundespulse.duckdb   (immutable, versioned snapshot)
        │  [read-only]
        ▼
   backend/  FastAPI (DuckDB read_only)             [this phase]
        │  GET /api/*
        ▼
   apps/web  React + Vite (proxy /api in dev)       [this phase]
```

## 2. Repository layout

```
BundesPulse/
├── apps/
│   └── web/                  React frontend (Vite, TS, Tailwind, ECharts, MapLibre GL)
├── backend/                  FastAPI backend — also the `backend` Python package
│   ├── api/                  REST routes + Pydantic schemas
│   ├── analytics/            analytical computations (foundation; Phase 3+)
│   ├── insights/             insight engine (foundation; Phase 3+)
│   └── tests/                backend unit tests
├── pipeline/                 offline data-build (build_data.py + stage scaffolds)
│   ├── sources/
│   ├── transforms/
│   └── validation/
├── data/                     never committed; gitignored except .gitkeep
│   ├── raw/                  source extractions
│   ├── processed/            cleaned/normalized intermediates
│   ├── geography/            boundaries / vector tiles
│   └── snapshots/            immutable DuckDB snapshots
├── docs/                     specs and reports
├── tests/                    cross-cutting / integration tests (later)
├── docker-compose.yml        optional containerised stack
├── Makefile                  cross-platform dev commands (macOS/Linux/CI)
└── package.json              npm workspace root + aggregate scripts
```

## 3. Backend

* `backend/` is both the repository directory **and** the importable Python
  package (its `package-dir` mapping declares `"backend" = "."` in
  `backend/pyproject.toml`). This keeps module paths like `backend.api.main`
  stable and lets the service run uninstalled from the repo root.
* The backend is a **read-only FastAPI** application:
  * `backend/api/main.py` — `create_app()` app factory + `app` instance.
  * `backend/api/health.py` — `GET /api/health`.
  * `backend/api/schemas.py` — Pydantic response models.
  * `backend/config.py` — `Settings` (snapshot path from
    `BUNDESPULSE_SNAPSHOT`; defaults to `data/snapshots/bundespulse.duckdb`).
  * `backend/db.py` — single lazy DuckDB connection, opened with
    `read_only=True`. Writes are refused by DuckDB itself.
* If no snapshot exists yet, the health endpoint reports an honest
  `configured: false` / `status: degraded` state. Data routes arrive in a
  later phase once the snapshot schema is defined.

### Snapshot schema

Produced offline by `pipeline/build_data.py` (linear: clean → map ids →
normalize → validate → write). Four tables:

* `regions(region_id, name, type, parent_id, area)`
* `indicators(indicator_id, slug, name, category, unit, description, raw_or_derived)`
* `observations(region_id, indicator_id, period, value, source_id)`
* `sources(source_id, provider, dataset, url, retrieval_date)`

Validation gates the build: unknown region/indicator references, duplicate
rows, and non-finite/out-of-range values fail loudly instead of shipping a bad
snapshot.

### Runtime rules
- Only **GET-style, side-effect-free** endpoints.
- DuckDB is always opened `read_only=True`; the backend can never mutate the
  snapshot.
- No ingestion, no scheduling, no microservices, no authentication.

## 4. Web frontend

* `apps/web` — React 18 + TypeScript, built with Vite.
* Styling: Tailwind CSS with shadcn/ui-style components (`src/components/ui/`).
* Charts: Apache ECharts (modular imports). MapLibre GL is a declared
  dependency ready for the Explore map (later phase).
* Server state: TanStack Query (`QueryClient` in `src/App.tsx`; health fetched
  via `src/lib/queries.ts`).
* API client: `src/lib/api.ts` — GET-only, base from `VITE_API_BASE_URL`
  (default `/api`). In dev, Vite proxies `/api` → `http://localhost:8000`.
* Routing: React Router v7; `BrowserRouter` lives in `src/main.tsx` so `App`
  is router-agnostic (and testable under `MemoryRouter`).
* Views are honest scaffolding (`src/pages/*`) declaring their
  product-spec responsibility — no fake feature implementations.

## 5. Conventions

- **Immutability:** nothing in the runtime path writes data. The snapshot is
  replaced by deploying a new one.
- **URL as canonical state:** deep-linkable routes (spec §10.2). Zustand is
  reserved only for transient UI state, not data fetching.
- **Honest scaffolding:** placeholder modules/stubs clearly announce their
  scope; nothing is presented as finished when it is not.
- **Type discipline:** strict TypeScript on the web; typed Pydantic models on
  the API.
- **Formatting/lint:** ESLint + Prettier-style via `eslint` (web), `ruff` + isort
  rules (Python).

## 6. Dev commands

Canonical commands (PowerShell/macOS zsh compatible):

| Task | Command |
|------|---------|
| Install backend | `python -m venv .venv` then `.venv/Scripts/pip install -e "backend[dev]"` |
| Install web | `npm install` |
| Run API (dev) | `npm run dev:api` (or `.venv/Scripts/python -m backend.api.main`) |
| Run web (dev) | `npm run dev:web` |
| Backend tests | `npm run test:api` |
| Web tests | `npm run test:web` |
| Backend lint | `npm run lint:api` |
| Web lint | `npm run lint:web` |
| Web build | `npm run build:web` |

`make …` mirrors these for macOS/Linux/CI (see `Makefile`).

## 7. Environment

* None required to run. Templates in `.env.example` /
  `backend/.env.example` / `apps/web/.env.example`.
* `BUNDESPULSE_SNAPSHOT` — path to the snapshot (relative to repo root or
  absolute).
* `VITE_API_BASE_URL` — API base the web client calls (default `/api`).
* `VITE_API_PROXY_TARGET` — dev proxy target (default `http://localhost:8000`).

## 8. Testing strategy

* `backend/tests/` — pytest (FastAPI `TestClient`), runs with
  `python -m pytest backend/tests -q`.
* `apps/web/src/**/*.test.{ts,tsx}` — Vitest + Testing Library
  (`npm run test:web`).
* `tests/` (repo root) — reserved for cross-component integration later.
* CI wiring (GitHub Actions) is a follow-up; the `Makefile` already expresses
  the pipeline.

## 9. What this phase deliberately does NOT provide

* Data endpoints/domain models (spec §8) — the snapshot schema now exists
  (see "Snapshot schema" above); read-only `/api` data routes come next.
* Official-source extraction and the full indicator catalogue —
  `build_data.py` establishes the workflow on committed sample data.
* Docker image builds — `docker-compose.yml` + Dockerfiles are written and
  `docker compose config` validates, but builds are parked until the stack is
  exercised (see README "Running with Docker").
* UI features beyond the application shell.