# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

CrossQL is a local web app for engineers working across a microservice architecture with multiple PostgreSQL databases per environment. You point it at a PostgreSQL server, it auto-discovers all databases, and lets you write a single SQL query spanning multiple DBs (`db_name.table` notation), executes sub-queries in parallel, merges results in DuckDB, and provides a Python analysis cell — no connection switching, no data export, no lag.

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
  config.py        Server-level YAML config, ${ENV_VAR} interpolation, Pydantic models
  models.py        All Pydantic request/response models
  connections.py   asyncpg pools + auto-discovery via pg_database
  query/
    parser.py      sqlglot AST → QueryPlan (sub-queries per DB + DuckDB merge SQL)
    executor.py    Parallel asyncpg execution → DuckDB merge → QueryResult
    schema.py      information_schema → SchemaCache for autocomplete
  sandbox/
    runner.py      Python subprocess sandbox with blocked imports + df injection
  tests/

frontend/src/
  App.tsx                    Three-pane layout (sidebar + editor/results)
  api/client.ts              Typed fetch wrappers for all endpoints
  store/useAppStore.ts       Zustand store with theme/palette persistence
  components/
    Icons.tsx                Inline SVG icon set
    TopBar.tsx               Logo, env switcher, theme toggle, refresh
    Sidebar.tsx              Server→DB→Table→Column tree browser
    QueryEditor.tsx          CodeMirror 6 SQL editor + autocomplete
    ResultsPanel.tsx         Subquery stats strip + results table + error/empty/running states
    PythonCell.tsx           CodeMirror 6 Python + output panel
    StatusBar.tsx            Bottom bar with env/DB health

e2e/tests/smoke.spec.ts      Playwright smoke test
docker/seed/                 PostgreSQL seed SQL for local dev
docs/design-reference/       Claude Design prototype files
```

## Architecture Notes

### Config: Server-Level with Auto-Discovery
Each environment in `connections.yaml` points to a single PostgreSQL server (host/port/user/password). On env switch, the backend connects to the `postgres` database, runs `SELECT datname FROM pg_database`, and auto-discovers all user databases. System databases (postgres, template0/1, azure_maintenance, etc.) are excluded.

### Cross-DB SQL Notation
Users write SQL using `db_name.table` to reference tables in different databases:
```sql
SELECT u.name, o.total
FROM users.users u
JOIN orders.orders o ON u.id = o.user_id
WHERE u.active = true AND o.status = 'paid'
```

### Query Execution Pipeline
1. `parser.py`: sqlglot AST → `QueryPlan` with per-DB sub-queries (predicates pushed down) + DuckDB merge SQL
2. `executor.py`: EXPLAIN row estimate check → parallel asyncpg → DuckDB register by table name → merge query
3. Single-DB queries skip DuckDB entirely — run directly against PostgreSQL

### Frontend Design System
- Fonts: Inter Tight (sans) + JetBrains Mono (mono)
- CSS variables: `--bg-0` through `--bg-4`, `--tx-1` through `--tx-4`, `--line-1` through `--line-3`, `--sx-*` for syntax colors
- 6 dark palettes: Default, Material, Dracula, Solarized, GitHub, Night Owl + Light theme
- Theme/palette stored in localStorage, applied via `data-theme` and `data-palette` attributes on `<html>`

### Session Store
`session_store: dict[str, QueryResult]` in `executor.py` — module-level dict. Frontend stores a UUID in localStorage; Python cell uses this UUID to access last query result.

### Python Sandbox
Subprocess with a custom `__import__` hook blocking dangerous modules. DataFrames injected via pickle. 30s hard timeout.

## Configuration

Copy `connections.example.yaml` → `connections.yaml` (gitignored). Passwords support `${ENV_VAR}` interpolation. No need to list databases — they're auto-discovered.

```yaml
environments:
  development:
    host: localhost
    port: 5434
    user: dev_user
    password: dev_pass
```

## Git Workflow

- `main` — stable, working code only (protected, requires PR)
- Feature branches for changes
- Never commit `connections.yaml` or any credentials
- Repo: github.com/DheerajKukreja9554/crossql
