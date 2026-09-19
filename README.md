# Deutschland Digital Monitor (BundesPulse)

A **read-only German regional data intelligence platform**: explore, compare,
rank, and understand official public statistics for the Federation, the sixteen
Bundesländer, and the ~400 Landkreise / kreisfreie Städte — through a polished,
interactive web interface.

> **Core principle**: the deployed product is a pure **read-only** consumer of a
> **pre-computed, immutable data snapshot**. All ingestion and computation happen
> offline in the data-build stage. There is **no user upload, no edit, no runtime
> ingestion, no government API calls at request time, and no accounts.**

---

## Live demo

- **Frontend** — deployed Vercel project (see [Deployment](#deployment)): `https://<your-project>.vercel.app`
- **Backend API** — deployed Railway service: `https://<your-service>.up.railway.app`

_Screenshots: a demo build is available as soon as the services above are
created; the repository ships no image assets._

---

## Main features

- **Explore** — choropleth map of Germany on the official BKG geography with
  real indicator values, hover tooltip (value + unit + rank), click-through to
  region profiles, and a clean legend that handles regions without data.
- **Region Profile** — overview KPIs (population, GDP, employment, …), a rule-based
  **Insights** layer ("… wuchs schneller als im Bund"), trend charts vs Germany,
  benchmark + rank comparison, "what changed", and per-indicator sources.
- **Compare** — pick 2–4 regions and see KPIs, synchronized time series, a
  comparison table and automatically derived differences — without claiming one
  region is "better".
- **Rankings** — rank / region / value / percentile table plus a value map for any
  indicator, period and level.
- **Data Explorer** — table, chart, summary KPIs, map and **CSV export** over
  indicator × period × level, with the per-indicator official source.
- **Relationship Explorer** — scatter plot of two indicators with Pearson /
  Spearman correlation, hover (region + values) and click-through; the page states
  explicitly that correlation is not causation.
- **Methodology & Sources** — short explanations of sources, definitions,
  percentage change, normalization, ranking, correlation, environmental
  aggregation and limitations, backed by the real snapshot data.

---

## Architecture

```
┌──────────────────┐      GET (read-only)      ┌──────────────────────────┐
│  Web frontend    │ ─────────────────────────▶│  FastAPI backend         │
│  React · Vite    │   /api/*                  │  DuckDB (read_only only) │
│  (Vercel)        │ ◀─────────────────────────│  (Railway / Docker)      │
└──────────────────┘        JSON/GeoJSON       └──────────────────────────┘
                                                      ▲
                                                      │ opens immutable file
                                        ┌─────────────┴─────────────┐
                                        │ data/snapshot/            │
                                        │  deutschland.duckdb       │
                                        │  regions.geojson          │
                                        │  indicator_metadata.json  │
                                        └───────────────────────────┘
```

Data flows **offline** into the snapshot (see [Data sources](#data-sources));
at runtime the API only executes `SELECT`s against the file.

## Technology

| Layer | Stack |
|-------|-------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · TanStack Query · Apache ECharts · MapLibre GL |
| Backend | Python 3.11 · FastAPI · Pydantic · DuckDB (read-only) · NumPy (analytics) |
| Pipeline | Python fetchers (requests/OpenPyXL/pyxlsb) → Polars/pandas/GeoPandas build |
| Deployment | Vercel (frontend, static) · Railway/Docker (backend) |

## Data sources

All values come from official, free public sources, fetched & cached offline;
the app never contacts them at runtime. **111 indicators** across Demography,
Labour, Employment, Economy, Income, Housing, Education, Environment,
Agriculture, Industry, Mobility, Infrastructure, Tourism, Health and Public
finance.

- **Regionalatlas / Regionaldatenbank Deutschland** — 80 curated indicators
  (density, births/deaths/migration, age, labour, enterprises, income, land use,
  waste, childcare, health, tourism, vehicles …) for Länder & Kreise, ~2000–2024,
  via the official ArcGIS REST backend (no website scraping)
- **Destatis** — population & age structure incl. mean age, foreign share,
  dependency ratios (2022–24), housing construction (2022), road accidents and
  fatalities (2024–25)
- **Arbeitskreis VGR der Länder** — GDP, GDP per capita and GDP growth (1991–2025)
- **Bundesagentur für Arbeit** — unemployment, quota and demographic breakdowns
  (youth <25, 55–65, long-term) per Kreis (Dec 2025); employment per Land (Jun 2022)
- **Bundesnetzagentur** — public charging points incl. fast charging (register)
- **Umweltbundesamt** — air-quality stations mapped to regions (NO₂/PM10 values
  currently absent — see limitations)
- **BKG (VG250)** — official region polygons for the map

Full provenance: [`docs/data-sources.md`](docs/data-sources.md).

---

## Local setup

Prerequisites: **Node 20+**, **Python 3.11+**, npm.

```bash
# 1. Install
npm install
python -m venv .venv
.venv/Scripts/pip install -e "backend[dev]"        # Windows PowerShell
# .venv/bin/pip install -e "backend[dev]"          # macOS / Linux

# 2. Run the API (http://localhost:8000, docs at /docs) — npm resolves the venv Python automatically
npm run dev:api

# 3. Run the web app (http://localhost:5173; proxies /api to :8000)
npm run dev:web
```

Open http://localhost:5173 — the home page loads live data from the prepared
snapshot; the header shows the backend connection status.

The API runs **without auto-reload** by default (uvicorn's reloader briefly
drops the socket on Windows, which shows up as transient 404/500 in the
browser). Enable it with `$env:BUNDESPULSE_RELOAD="1"` (PowerShell) before
`npm run dev:api` if you want restart-on-save.

Commands: `npm run dev:api` · `npm run dev:web` · `npm run test:api` ·
`npm run test:web` · `npm run lint:api` · `npm run lint:web` ·
`npm run typecheck:web` · `npm run build:web`. On macOS/Linux/CI the same tasks
run via `make …`.

### Data snapshot

The API reads an immutable DuckDB snapshot. To rebuild it from official sources:

```bash
.venv/Scripts/pip install -r pipeline/requirements.txt      # install once
.venv/Scripts/python -m pipeline.fetch_destatis             # Demography (Destatis)
.venv/Scripts/python -m pipeline.fetch_destatis_more        # Economy / Housing / Traffic
.venv/Scripts/python -m pipeline.fetch_arbeitsagentur       # Employment (BA)
.venv/Scripts/python -m pipeline.fetch_netzagentur          # Charging (BNetzA)
.venv/Scripts/python -m pipeline.fetch_umweltbundesamt      # Air quality (UBA)
.venv/Scripts/python -m pipeline.build_data                 # merge -> DuckDB snapshot
```

Output under `data/snapshot/`: `deutschland.duckdb` (base tables + precomputed
`rankings`, `trends`, `insights`), `regions.geojson`, `indicator_metadata.json`.
Set `BUNDESPULSE_SNAPSHOT` to point at a different file. Snapshot files are build
artifacts (gitignored); `data/raw/sample/` provides a runnable fallback.

---

## Deployment

Simple, two-part hosting. The backend image **contains the prepared snapshot**,
so no external data service is ever needed.

### Backend (Railway or any Docker host)

1. Push/publish the repository (or `railway up` from the repo root so the local
   snapshot is uploaded).
2. Railway auto-detects the root **`Dockerfile`** (also see `railway.json` —
   healthcheck `/api/health`, restart on failure).
3. The image `COPY`s `backend/` **and** `data/snapshot/` and runs
   `uvicorn backend.api.main:app`. Deploy → you get `https://<app>.up.railway.app`.

> Git-based deploys respect `.gitignore`, which excludes the snapshot. Either use
> `railway up` (uploads your working directory) or commit `data/snapshot/` before
> deploying.

### Frontend (Vercel)

1. Add the **`apps/web`** folder as a Vercel project (framework preset: Vite,
   build `npm run build`, output `dist`).
2. Add the environment variable `VITE_API_BASE_URL` = your Railway URL
   (e.g. `https://bundespulse-api.up.railway.app`) and redeploy.
3. `vercel.json` rewrites every path to `index.html` so all routes work.

Alternative: keep `VITE_API_BASE_URL=/api` and reverse-proxy `/api/*` to the
backend (e.g. an additional Vercel rewrite or ingress). The API is CORS-open for
GETs, so a direct cross-origin setup also works.

### Local Docker

```bash
docker compose up --build     # api on :8000 (snapshot baked in), web on :8080
```

### Production checks (verified)

All eleven flows are exercised by the test suite and verified against the
containerized backend served from its built-in snapshot: open site · explore map ·
switch indicator · open region · region profile + insights · compare · rankings ·
data explorer · relationships · methodology.

---

## Read-only API

All endpoints are GET-only and read the prepared snapshot (`/docs` for OpenAPI):

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | service + snapshot status |
| `GET /api/regions` | regions (optional `?level=bundesland\|kreis`) |
| `GET /api/regions/{id}` | single region (e.g. `09`) |
| `GET /api/indicators` | indicator catalog with per-indicator sources |
| `GET /api/regions/{id}/profile` | region + KPI insights + trends |
| `GET /api/regions/{id}/narratives` | **rule-based insights** (analytical statements) |
| `GET /api/regions/{id}/indicators/{slug}` | time series with change measures |
| `GET /api/compare?regions=09,08&indicator=gdp_pc` | compare 1–4 regions |
| `GET /api/rankings?indicator=unemp_rate&level=kreis&order=asc` | rankings + percentile |
| `GET /api/correlation?x=pop_growth&y=gdp_pc` | Pearson + Spearman + points (association only) |
| `GET /api/indicators/{slug}/periods?level=…` | available years for indicator/level |
| `GET /api/sources` · `GET /api/metadata` | source register / snapshot + catalog |
| `GET /api/regions.geojson` | official BKG boundaries for the map |

Unknown regions/indicators return `404`; a missing snapshot returns `503`.

---

## Status & documentation

Completed: product spec · data pipeline (7 domains) · production snapshot ·
read-only API · full UI (Explore, Region, Compare, Rankings, Data Explorer,
Relationships, Methodology) · rule-based insights · deployment setup.

- [`docs/product-spec.md`](docs/product-spec.md) — product spec, measures taxonomy, insight rules, UX principles, non-goals
- [`docs/architecture.md`](docs/architecture.md) — architecture & decisions
- [`docs/data-sources.md`](docs/data-sources.md) — data provenance per domain
- [`docs/phase-3-report.md`](docs/phase-3-report.md) — data-build details & known gaps

**Known limitations** (documented on the Methodology page): UBA NO₂/PM10 values
unavailable; employment/housing/charging are single-year; unemployment is
Kreis-level only; regional population spans 2023–2024.