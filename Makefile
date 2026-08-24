# BundesPulse — development commands (cross-platform convenience).
# The canonical commands for Windows PowerShell are in README.md; this Makefile
# mirrors them for macOS/Linux and CI.

.SHELLFLAGS := -e-c

.PHONY: install install-backend install-web dev dev-api dev-web build build-web test test-api test-web lint lint-api lint-web typecheck-web format-api

## Install all toolchain + dependencies
install: install-backend install-web

## Install backend into .venv (Python 3.11+)
install-backend:
	python -m venv .venv
	.venv/bin/python -m pip install --upgrade pip
	.venv/bin/python -m pip install -e "backend[dev]"

## Install web dependencies
install-web:
	npm install

## Run both API and web dev servers
dev: dev-api dev-web

## Dev server (backend) on :8000
dev-api:
	.venv/bin/python -m backend.api.main

## Dev server (web) on :5173
dev-web:
	npm run dev:web

## Build everything (typecheck + vite build)
build: build-web

build-web:
	npm run build:web

## Run all tests
test: test-api test-web

test-api:
	.venv/bin/python -m pytest backend/tests -q
	.venv/bin/python -m pytest tests -q

test-web:
	npm run test:web

lint: lint-api lint-web

lint-api:
	.venv/bin/ruff check backend pipeline tests

lint-web:
	npm run lint:web

format-api:
	.venv/bin/ruff format backend pipeline tests

typecheck-web:
	npm run typecheck:web