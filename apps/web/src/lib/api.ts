/**
 * Read-only API client for the Deutschland Digital Monitor backend.
 *
 * All requests are GET-only, matching the immutable/precomputed-data model.
 * In development the Vite dev server proxies `/api` to the FastAPI backend
 * (see vite.config.ts); in production the API must be served from the same
 * origin or behind a reverse proxy.
 */

export interface SnapshotInfo {
  configured: boolean
  path: string | null
}

export interface HealthResponse {
  status: string
  service: string
  version: string
  snapshot: SnapshotInfo
  timestamp: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api"

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/health")
}