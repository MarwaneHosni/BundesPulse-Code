# BundesPulse — deployable API image (Railway/Vercel-Docker/any simple host).
# The prepared, immutable DuckDB snapshot is baked INTO the image, so the
# running service never contacts government APIs at request time.
FROM python:3.11-slim

WORKDIR /app

# Backend package (module path: backend.api.main:app)
COPY backend ./backend
# Pre-built snapshot: deutschland.duckdb + regions.geojson + indicator_metadata.json
COPY data/snapshot ./data/snapshot

# The image only needs the runtime deps of the read-only API.
RUN pip install --no-cache-dir \
    "fastapi>=0.111" \
    "uvicorn[standard]>=0.30" \
    "pydantic>=2.7" \
    "duckdb>=1.0" \
    "numpy>=1.26"

ENV BUNDESPULSE_SNAPSHOT=/app/data/snapshot/deutschland.duckdb

EXPOSE 8000

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]