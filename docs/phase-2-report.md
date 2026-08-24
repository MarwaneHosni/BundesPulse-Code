# Phase 2 Report — Repository & Application Architecture

**Date:** 2026-08-24
**Phase:** 2 — establish the repository structure and a runnable application
foundation (frontend + backend + conventions).

## 1. What was created / changed

| Area | What |
|------|------|
| Layout | Monorepo per the agreed structure: `apps/web`, `backend/` (+ `api`, `analytics`, `insights`, `tests`), `pipeline/` (`sources`, `transforms`, `validation`), `data/` (`raw`, `processed`, `geography`, `snapshots`, gitignored), `docs/`, `tests/`. |
| Backend | FastAPI app (`create_app()` factory), Pydantic models, lazy **read-only** DuckDB connection, `GET /api/health`, tests via pytest/TestClient. Importable as the `backend` package. |
| Frontend | React 18 + TS + Vite app shell with routes for all seven views, Tailwind + shadcn/ui components, TanStack Query health fetch, GET-only API client, Vitest + Testing Library tests. |
| Conventions | Root `package.json` npm workspace + aggregate scripts, `Makefile`, ruff (backend), ESLint (web), strict TS, `.gitignore`, env templates, root pytest/`tests` dir reserved for integration. |
| Docs | `docs/architecture.md` created; `README.md` rewritten (layout, commands, snapshot env, status). |
| Docker | `docker-compose.yml` + `backend/Dockerfile` + `apps/web/Dockerfile` + nginx proxy config; `docker compose config` validated. Builds parked (see §4). |
| CI | `.github/workflows/ci.yml` — install, lint-backend, test back+web, build web. |

## 2. Validation performed (all green)

- Backend tests: **3 passed** (`pytest -q backend/tests`) — health payload and
  POST rejection guard.
- Backend lint: `ruff check backend pipeline tests` → 0 errors.
- Backend startup: uvicorn boots; `GET /api/health` returns JSON, honest
  `configured:false` without a snapshot.
- DuckDB read-only guarantee: opening `read_only=True` and issuing `CREATE`
  fails (`Cannot execute … in read-only mode`).
- Frontend build: `tsc -b && vite build` → success (dist emitted).
- Frontend tests: **4 passed** (Vitest + Testing Library) — shell render, nav,
  not-found, cn util.
- Frontend lint: ESLint 0 errors / 2 warnings (standard shadcn react-refresh).
- **Integration**: Vite dev server proxy → FastAPI works end-to-end
  (`5173/api/health` → 200 JSON); Vite serves the app (HTTP 200).
- `npm audit`: **0 vulnerabilities** (vite 8 / vitest 4 / react-router 7 gold
  line).
- `docker compose config`: valid.

## 3. Decisions taken

1. **`backend/` = the `backend` Python package.** Package-dir mapping
   `"backend" = "."` in `backend/pyproject.toml`; module paths are
   `backend.api.*`, matching the conceptual layering and usable both installed
   (editable) and uninstalled from the repo root.
2. **DuckDB opened strictly `read_only=True`**; writes refused by the engine
   itself (verified in a smoke test).
3. **Honest snapshot state**: no snapshot yet → `/api/health` reports
   `status:"degraded"`, `configured:false`; no fake "ready" claims.
4. **Router split**: `BrowserRouter` in `main.tsx`, `App` is router-agnostic —
   keeps components testable under `MemoryRouter` and avoids nested-router
   errors in react-router v7.
5. **Modern pinned toolchain** to clear `npm audit`: vite 8, vitest 4,
   react-router 7, plugin-react 6 — 0 vulnerabilities at commit time.
6. **Get-only client**: `lib/api.ts` issues only GET with a configurable base
   (`VITE_API_BASE_URL`, default `/api`; dev proxy in `vite.config.ts`).
7. **Scaffolding is honest**: pages and analytics/insights modules declare
   their spec responsibility; nothing claims implemented features that are not.

## 4. Deferred (explicitly, not forgotten)

- Docker **image builds** and `docker compose up` — parked per maintainer
  decision; compose config + Dockerfiles are in place and validated.
- Backend **data endpoints / domain models** — depend on the snapshot schema
  produced by the data-build phase.
- `pipeline/` implementation and the actual snapshot — Phase 3.
- Full UI per product-spec §9 — Phase 4.
- GitHub Actions run has not been exercised on a runner yet; the workflow is
  created and mirrors validated local commands.

## 5. Next step

Phase 3 — data-build pipeline: lock the indicator catalogue against real source
availability (`backend/analytics` + `pipeline/`), produce
`data/snapshots/bundespulse.duckdb`, define the domain schema, then expose
`/api` data endpoints.