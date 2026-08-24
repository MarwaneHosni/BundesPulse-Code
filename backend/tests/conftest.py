"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

import pytest
from backend.api.main import create_app
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> TestClient:
    with TestClient(create_app()) as test_client:
        yield test_client
