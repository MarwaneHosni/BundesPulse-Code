# BundesPulse  ERepository & Application Architecture

**Phase:** 2  Erepository and application foundation.
**Model:** immutable/precomputed-data ↁEread-only API ↁEread-only web app.

---

## 1. System overview

The product is split into two conceptual systems that are deliberately kept
apart:

1. **Offline data preparation** (`pipeline/`, Phase 3)  Etakes government data
   and produces a prepared, immutable snapshot.
2. **Production application** (`backend/` + `apps/web`)  Ea read-only FastAPI
   service and a read-only React frontend over that snapshot.

The production application **never** ingests external APIs, never writes data,
and has no authentication.

```
   official sources (Destatis, BA, BKG, UBA, BNetzA, GovData)
        ━E [offline]
        ▼
   pipeline/  (extract ↁEtransform ↁEvalidate)      [Phase 3]
        ━E        ▼
   data/snapshot/deutschland.duckdb   (immutable, versioned snapshot)
        ━E [read-only]
        ▼
   backend/  FastAPI (DuckDB read_only)             [this phase]
        ━E GET /api/*
        ▼
   apps/web  React + Vite (proxy /api in dev)       [this phase]
```

## 2. Repository layout

```
BundesPulse/
├── apps/
━E  └── web/                  React frontend (Vite, TS, Tailwind, ECharts, MapLibre GL)
├── backend/                  FastAPI backend  Ealso the `backend` Python package
━E  ├── api/                  REST routes + Pydantic schemas
━E  ├── analytics/            analytical computations (foundation; Phase 3+)
━E  ├── insights/             insight engine (foundation; Phase 3+)
━E  └── tests/                backend unit tests
├── pipeline/                 offline data-build (build_data.py + stage scaffolds)
━E  ├── sources/
━E  ├── transforms/
━E  └── validation/
├── data/                     never committed; gitignored except .gitkeep
━E  ├── raw/                  source extractions
━E  ├── processed/            cleaned/normalized intermediates
━E  ├── geography/            boundaries / vector tiles
━E  └── snapshot/             production snapshot: deutschland.duckdb, regions.geojson, indicator metadata
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
  * `backend/api/main.py`  E`create_app()` app factory + `app` instance.
  * `backend/api/health.py`  E`GET /api/health`.
  * `backend/api/data.py` – read-only data endpoints over the
    snapshot (`/regions`, `/indicators`, `/regions/{id}/profile`, `/compare`,
    `/rankings`, `/correlation`, `/insights`, `/sources`, `/metadata`), with
    404 on unknown regions/indicators and 503 without a snapshot.
  * `backend/api/schemas.py`  EPydantic response models.
  * `backend/config.py`  E`Settings` (snapshot path from
    `BUNDESPULSE_SNAPSHOT`; defaults to `data/snapshot/deutschland.duckdb`).
  * `backend/analytics/measures.py`  Ecore analytical measures (percentage
    change, year-over-year change, region-vs-benchmark comparisons, ranking,
    percentiles, per-capita/per-10,000 normalisation, Pearson/Spearman
    correlation, z-score anomaly detection). Pure functions that handle
    missing values, zero denominators and insufficient data.
  * `backend/db.py`  Esingle lazy DuckDB connection, opened with
    `read_only=True`. Writes are refused by DuckDB itself.
* If no snapshot exists yet, the health endpoint reports an honest
  `configured: false` / `status: degraded` state, and data routes return 503.

### Snapshot schema

Produced offline by `pipeline/build_data.py` (linear: clean ↁEmap ids ↁEnormalize ↁEvalidate ↁEwrite). Four tables:

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

* `apps/web`  EReact 18 + TypeScript, built with Vite.
* Styling: Tailwind CSS with shadcn/ui-style components (`src/components/ui/`).
* Charts: Apache ECharts (modular imports). MapLibre GL is a declared
  dependency ready for the Explore map (later phase).
* Server state: TanStack Query (`QueryClient` in `src/App.tsx`; health fetched
  via `src/lib/queries.ts`).
* API client: `src/lib/api.ts`  EGET-only, base from `VITE_API_BASE_URL`
  (default `/api`). In dev, Vite proxies `/api` ↁE`http://localhost:8000`.
* Routing: React Router v7; `BrowserRouter` lives in `src/main.tsx` so `App`
  is router-agnostic (and testable under `MemoryRouter`).
* Views are honest scaffolding (`src/pages/*`) declaring their
  product-spec responsibility  Eno fake feature implementations.

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
* `BUNDESPULSE_SNAPSHOT`  Epath to the snapshot (relative to repo root or
  absolute).
* `VITE_API_BASE_URL`  EAPI base the web client calls (default `/api`).
* `VITE_API_PROXY_TARGET`  Edev proxy target (default `http://localhost:8000`).

## 8. Testing strategy

* `backend/tests/`  Epytest (FastAPI `TestClient`), runs with
  `python -m pytest backend/tests -q`.
* `apps/web/src/**/*.test.{ts,tsx}`  EVitest + Testing Library
  (`npm run test:web`).
* `tests/` (repo root)  Ereserved for cross-component integration later.
* CI wiring (GitHub Actions) is a follow-up; the `Makefile` already expresses
  the pipeline.

## 9. What this phase deliberately does NOT provide

* Data endpoints/domain models (spec §8)  Ethe snapshot schema now exists
  (see "Snapshot schema" above); read-only `/api` data routes come next.
* Official-source extraction and the full indicator catalogue  E  `build_data.py` establishes the workflow on committed sample data.
* Docker image builds  E`docker-compose.yml` + Dockerfiles are written and
  `docker compose config` validates, but builds are parked until the stack is
  exercised (see README "Running with Docker").
* UI features beyond the application shell.
