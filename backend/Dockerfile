FROM python:3.11-slim

WORKDIR /app

# The repo-level `backend/` directory is the `backend` Python package
# (see backend/pyproject.toml package-dir mapping). Lay it out identically.
COPY pyproject.toml ./
COPY __init__.py config.py db.py ./backend/
COPY api ./backend/api
COPY analytics ./backend/analytics
COPY insights ./backend/insights

RUN pip install --no-cache-dir "fastapi>=0.111" "uvicorn[standard]>=0.30" "pydantic>=2.7" "duckdb>=1.0"

EXPOSE 8000

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]