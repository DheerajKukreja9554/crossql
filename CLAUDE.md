# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

DB Simplifier is a local web app for engineers working across a microservice architecture with multiple PostgreSQL databases per environment. It lets you write a single SQL query spanning multiple DBs (`db_name.table` notation), executes sub-queries in parallel, merges results in DuckDB, and provides a Python analysis cell — no connection switching, no data export, no lag.

## Dev Commands

```bash
# Install all dependencies
make install

# Start local PostgreSQL test databases (Docker required)
make db-up

# Start backend + frontend concurrently
make dev

# Run backend only (port 8000)
make backend

# Run frontend only (port 5173)
make frontend

# Run all tests
make test

# Run backend tests only
make test-backend

# Run a single backend test
cd backend && uv run pytest tests/test_parser.py::test_simple_cross_db_join -v

# Run e2e tests (both servers must be running)
make test-e2e

# Lint + format check
make lint
```

## Project Structure

```
backend/
  main.py          FastAPI app, lifespan, all routes
  config.py        Load connections.yaml, ${ENV_VAR} interpolation, Pydantic models
  models.py        All Pydantic request/response models
  connections.py   asyncpg pool registry per (env, db_name)
  query/
    parser.py      sqlglot AST → QueryPlan (sub-queries per DB + DuckDB merge SQL)
    executor.py    Parallel asyncpg execution → DuckDB merge → QueryResult
    schema.py      information_schema → SchemaCache for autocomplete
  sandbox/
    runner.py      Python subprocess sandbox with blocked imports + df injection
  tests/
    conftest.py    testcontainers PostgreSQL fixtures
    test_parser.py
    test_executor.py
    test_sandbox.py
    test_api.py

frontend/src/
  App.tsx                    Three-zone layout
  api/client.ts              Typed fetch wrappers for all endpoints
  store/useAppStore.ts       Zustand store
  components/
    EnvSwitcher.tsx          Environment dropdown + per-DB status badges
    QueryEditor.tsx          CodeMirror 6 SQL editor + autocomplete
    ResultsTable.tsx         @tanstack/react-table with sort + warnings
    PythonCell.tsx           CodeMirror 6 Python + output panel

e2e/tests/smoke.spec.ts      Playwright smoke test
docker/seed/                 PostgreSQL seed SQL for local dev
```

## Architecture Notes

### Cross-DB SQL Notation
Users write SQL using `db_name.table` to reference tables in different databases:
```sql
SELECT u.name, o.total
FROM users_db.users u
JOIN orders_db.orders o ON u.id = o.user_id
WHERE u.active = true AND o.status = 'paid'
```
`sqlglot` parses this — `db_name` maps to `Table.db` in the AST.

### Query Execution Pipeline
1. `parser.py`: sqlglot AST → `QueryPlan` with per-DB sub-queries (predicates pushed down) + DuckDB merge SQL
2. `executor.py`: EXPLAIN row estimate check → parallel asyncpg → DuckDB register by alias → merge query
3. DuckDB tables registered **by alias** (not table name) to avoid collisions when two DBs share a table name
4. Single-DB queries skip DuckDB entirely — run directly against PostgreSQL

### Session Store
`session_store: dict[str, QueryResult]` in `executor.py` — module-level dict. Frontend stores a UUID in localStorage; Python cell uses this UUID to access last query result.

### Python Sandbox
Subprocess with a custom `__import__` hook blocking: `os, subprocess, sys, socket, shutil, pty, ctypes, multiprocessing, importlib`. DataFrames injected via pickle. 30s hard timeout.

### Predicate Pushdown Scope
Only simple column comparisons pushed to PostgreSQL (`col = val`, `col > val`, etc.). Subqueries in WHERE, EXISTS, IN (subselect) with cross-DB refs run entirely in DuckDB.

## Configuration

Copy `connections.example.yaml` → `connections.yaml` (gitignored). Passwords support `${ENV_VAR}` interpolation.

## Git Workflow

- `main` — stable, working code only
- Feature branches: `feature/parser`, `feature/frontend`, etc.
- PRs for each feature; use `code-review` skill before merging
- Never commit `connections.yaml` or any credentials
