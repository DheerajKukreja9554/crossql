# CrossQL — Progress Tracker

## Status: Phase 1 Complete, Phase 2 Planned

---

## Phase 1 — Local Single-User Web App (MVP)

### Completed (2026-04-18 → 2026-04-20)

**Backend:**
- [x] `config.py` — Server-level YAML config + `${ENV_VAR}` interpolation
- [x] `connections.py` — asyncpg pool manager + auto-discovery via `pg_database`
- [x] `models.py` — all request/response models (environments, switch, reload, query, python)
- [x] `query/parser.py` — sqlglot cross-DB SQL parser, predicate pushdown, single-DB passthrough
- [x] `query/executor.py` — parallel execution, EXPLAIN estimates, DuckDB merge, Decimal/UUID serialization
- [x] `query/schema.py` — information_schema fetcher for autocomplete
- [x] `sandbox/runner.py` — subprocess Python sandbox, blocked imports, DataFrame injection
- [x] `main.py` — FastAPI app, CORS, lifespan, file-based logging (`logs/backend.log`)
- [x] `/api/config/reload` — hot-reload connections.yaml without restart
- [x] Unit tests: 12 parser tests, 9 sandbox tests (all passing)
- [x] Integration test fixtures updated for single-server architecture

**Frontend:**
- [x] Design system — Inter Tight + JetBrains Mono, 6 dark palettes + light theme
- [x] `TopBar` — logo, env switcher pill, theme toggle, refresh button
- [x] `Sidebar` — server → database → table → column tree browser with search
- [x] `QueryEditor` — CodeMirror 6, alias-aware autocomplete (Tab to accept), db/table/column suggestions
- [x] `ResultsPanel` — subquery stats strip, sortable table, error/empty/running states, CSV export
- [x] `PythonCell` — collapsible panel, CodeMirror Python, sandboxed output
- [x] `StatusBar` — environment + DB health
- [x] Zustand store with theme/palette persistence
- [x] Robust error handling (network errors, non-JSON responses, malformed errors)

**Infrastructure:**
- [x] Docker: single PostgreSQL container with multiple databases
- [x] GitHub repo: github.com/DheerajKukreja9554/crossql (protected main)
- [x] Git workflow: feature branches + PRs
- [x] CLAUDE.md, README.md, connections.example.yaml

---

## Phase 2 — Performance + Polish

### Optimizations (from Phase 1 learnings)

- [ ] **Lazy connection pools** — don't create pools for all 44 databases on env switch; connect on first query to that DB instead. Reduces startup time from O(n) to O(1).
- [ ] **Debounced alias parsing in autocomplete** — currently rebuilds CodeMirror extensions on every keystroke because alias map depends on SQL text. Debounce to 300ms or parse aliases outside the extension chain.
- [ ] **Schema caching per environment** — cache schema in localStorage, only re-fetch when config reloads or env switches. Avoids querying information_schema on every switch.
- [ ] **Code-split CodeMirror** — dynamic import() for CodeMirror bundle (currently 658KB of the 658KB total). Lazy-load on first editor focus.
- [ ] **Connection health polling** — periodic `SELECT 1` heartbeat to detect stale connections instead of only checking on env switch.

### Features

- [ ] **Query history** — persist last N queries in localStorage, accessible from sidebar or ⌘K palette
- [ ] **Saved queries** — name and save frequently used queries, stored in a local YAML/JSON file
- [ ] **Runtime connection management via UI** — add/edit/remove environments without editing YAML
- [ ] **Command palette (⌘K)** — search tables, switch envs, run actions
- [ ] **EXPLAIN viewer** — visualize query plan from PostgreSQL EXPLAIN output
- [ ] **Dark palette switcher in UI** — currently only code-level; add a settings panel to switch palettes
- [ ] **Per-DB row cap controls** — inline cap chip in editor, per-DB overrides in sidebar
- [ ] **Env switch validation overlay** — test each DB connection in sequence before switching

---

## Phase 3 — Multi-User + Desktop

### Multi-User

- [ ] Basic auth (username/password or SSO)
- [ ] Per-user query history + saved queries
- [ ] Role-based access (read-only vs admin environments)
- [ ] Audit log (who ran what query when)

### Desktop App

- [ ] Tauri packaging for macOS
- [ ] System tray integration
- [ ] Keychain credential storage (no plaintext passwords)
- [ ] Auto-update mechanism

---

## Phase 4 — Extended Support

- [ ] MySQL, MongoDB connector support
- [ ] Charts (bar, line, scatter via Plotly or Recharts)
- [ ] Export: CSV, Excel, JSON, Parquet
- [ ] Notebook format (save + share analysis sessions)
- [ ] Query performance insights (EXPLAIN tree viewer)
- [ ] AI-assisted query writing (natural language → SQL)

---

## Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-18 | DuckDB for in-memory merge | No data lag, real-time, handles cross-DB JOINs cleanly |
| 2026-04-18 | sqlglot for SQL parsing | PostgreSQL dialect support, clean AST for predicate analysis |
| 2026-04-18 | Tables registered by table name in DuckDB | Merge SQL uses `FROM table AS alias`, so register by real name |
| 2026-04-18 | subprocess sandbox over RestrictedPython | Simpler, sufficient for local single-user tool |
| 2026-04-18 | Single-DB passthrough | Skip DuckDB for non-cross-DB queries — faster |
| 2026-04-19 | Server-level config + auto-discovery | User has one Azure server per env with many DBs — listing each manually is tedious |
| 2026-04-19 | Inter Tight + JetBrains Mono + 6 palettes | Design from Claude Design prototype; professional developer tool aesthetic |
| 2026-04-20 | Tab to accept autocomplete (not Enter) | Matches IDE conventions; Enter should insert newlines in SQL editor |
| 2026-04-20 | _sanitize_rows() for JSON serialization | asyncpg returns Decimal, UUID, datetime — Pydantic needs JSON-safe types |
| 2026-04-20 | Lazy connection pools (Phase 2) | Current approach connects to all 44 DBs on switch — too slow for production |
