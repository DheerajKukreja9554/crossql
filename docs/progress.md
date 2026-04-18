# DB Simplifier — Progress Tracker

## Status: 🚧 Phase 1 In Progress

---

## Phase 1 — Local Single-User Web App (MVP)

### ✅ Completed
- [x] Requirements document (`docs/requirements.md`)
- [x] Design document (`docs/superpowers/specs/2026-04-18-db-simplifier-design.md`)
- [x] Git repository initialized
- [x] Project scaffolding (directory structure, .gitignore, Makefile)
- [x] `docker-compose.yml` with 2 PostgreSQL test instances + seed data
- [x] `connections.example.yaml`
- [x] `CLAUDE.md`
- [x] `README.md`

### ✅ Completed (2026-04-18)
- [x] Backend: `config.py` — YAML loader + Pydantic validation + ${ENV_VAR} interpolation
- [x] Backend: `models.py` — all request/response models
- [x] Backend: `connections.py` — asyncpg pool manager per env
- [x] Backend: `query/schema.py` — information_schema fetcher
- [x] Backend: `query/parser.py` — sqlglot cross-DB SQL parser, predicate pushdown, single-DB passthrough
- [x] Backend: `query/executor.py` — parallel execution, EXPLAIN estimates, DuckDB merge, session store
- [x] Backend: `sandbox/runner.py` — subprocess Python sandbox, blocked imports, DataFrame injection
- [x] Backend: `main.py` — FastAPI app, CORS, lifespan, all 5 endpoints
- [x] Backend: `pyproject.toml` — uv project with all dependencies
- [x] Backend: `tests/test_parser.py` — unit tests (no DB needed)
- [x] Backend: `tests/test_executor.py` — integration tests (testcontainers)
- [x] Backend: `tests/test_sandbox.py` — sandbox unit tests
- [x] Backend: `tests/conftest.py` — testcontainers fixtures
- [x] Frontend: Vite + React + TypeScript scaffold
- [x] Frontend: `api/client.ts` — typed API client
- [x] Frontend: `store/useAppStore.ts` — Zustand store
- [x] Frontend: `EnvSwitcher.tsx`
- [x] Frontend: `QueryEditor.tsx` — CodeMirror 6 SQL + autocomplete
- [x] Frontend: `ResultsTable.tsx` — @tanstack/react-table with sort
- [x] Frontend: `PythonCell.tsx` — CodeMirror 6 Python + output panel
- [x] Frontend: `App.tsx` — three-zone layout wiring
- [x] Frontend: `styles.css` — dark developer tool theme
- [x] E2E: Playwright smoke test scaffold

### ⏳ Pending
- [ ] Run `make install` and verify all deps install cleanly
- [ ] Run `make db-up` and verify seed data
- [ ] Run `make test-backend` and fix any failing tests
- [ ] Run `make dev` and verify full app works end-to-end
- [ ] Push to GitHub

---

## Phase 2 — Team Access + Runtime Connections

**Planned features:**
- Runtime connection management via UI
- Multi-user support (basic auth + sessions)
- Query history persistence
- Saved queries

---

## Phase 3 — macOS Desktop App

**Planned features:**
- Tauri packaging
- System tray integration
- Keychain credential storage

---

## Phase 4 — Extended Support

**Planned features:**
- MySQL, MongoDB support
- Charts (bar, line, scatter)
- CSV/Excel/JSON export
- Notebook format (save + share)
- Query performance insights (EXPLAIN viewer)

---

## Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-18 | DuckDB for in-memory merge | No data lag, real-time, handles cross-DB JOINs cleanly |
| 2026-04-18 | sqlglot for SQL parsing | PostgreSQL dialect support, clean AST for predicate analysis |
| 2026-04-18 | Tables registered by alias in DuckDB | Avoids name collision when two DBs share a table name |
| 2026-04-18 | subprocess sandbox over RestrictedPython | Simpler, sufficient for local single-user tool |
| 2026-04-18 | Single-DB passthrough | Skip DuckDB for non-cross-DB queries — faster |
| 2026-04-18 | uv for Python deps | Faster than pip, lockfile support |
