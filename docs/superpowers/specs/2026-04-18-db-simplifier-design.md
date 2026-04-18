# DB Simplifier — Design Document

**Date:** 2026-04-18
**Phase:** 1 (MVP)

---

## 1. Problem & Goals

You have 5–6 environments (dev, staging, prod, etc.). Each environment contains multiple PostgreSQL databases — one per microservice (e.g. `users_db`, `orders_db`, `payments_db`). Data within one environment is related across these DBs. Data across environments is independent.

**Pain points today:**
- Switching DBeaver connections to query a different DB is tedious
- No way to JOIN across DBs natively in PostgreSQL
- Analysis requires exporting to files and writing Python scripts

**Goal:** A local web app where you pick an environment, write a single SQL query that spans multiple DBs (using `db_name.table` notation), get results in one place, and optionally analyze with Python — no file exports, no connection switching, no data lag.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (React)                     │
│                                                          │
│  ┌─────────────┐  ┌────────────────────┐  ┌──────────┐  │
│  │ EnvSwitcher │  │   QueryEditor      │  │ Python   │  │
│  │ (dropdown + │  │   (CodeMirror SQL) │  │ Cell     │  │
│  │  DB badges) │  │   + ResultsTable   │  │(CodeMirr)│  │
│  └─────────────┘  └────────────────────┘  └──────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────┐
│                    FastAPI Backend                        │
│                                                          │
│  config.py          connections.py      query/schema.py  │
│  (YAML → models)    (asyncpg pools)     (info_schema)    │
│                                                          │
│  query/parser.py ──→ query/executor.py                   │
│  (sqlglot AST)       (parallel PG + DuckDB merge)        │
│                                                          │
│  sandbox/runner.py                                       │
│  (subprocess + df injection)                             │
└────────────┬──────────────────┬───────────────────────┘
             │                  │
      ┌──────▼──────┐   ┌───────▼──────┐
      │  users_db   │   │  orders_db   │  ← same environment
      │ (PostgreSQL)│   │ (PostgreSQL) │
      └─────────────┘   └─────────────┘
```

---

## 3. Data Flow

### 3a. Cross-DB Query Execution

```
1. User types SQL:
   SELECT u.name, o.total
   FROM users_db.users u
   JOIN orders_db.orders o ON u.id = o.user_id
   WHERE u.active = true AND o.status = 'paid'

2. parser.py (sqlglot):
   - Finds Table nodes: users_db.users, orders_db.orders
   - Groups by DB: { users_db: [users], orders_db: [orders] }
   - Pushes predicates:
       users_db sub-query: SELECT * FROM users u WHERE u.active = true
       orders_db sub-query: SELECT * FROM orders o WHERE o.status = 'paid'
   - Merge SQL (DuckDB): original query with db_name. prefix stripped

3. executor.py:
   - EXPLAIN each sub-query → row estimate check (abort if > 50k)
   - asyncio.gather: run both sub-queries in parallel on asyncpg pools
   - Load results into DuckDB: conn.register("u", df_users), conn.register("o", df_orders)
   - Execute merge SQL in DuckDB → unified result DataFrame

4. Store result in session_store[session_id], return JSON to browser
```

### 3b. Python Analysis

```
1. User writes Python in PythonCell:
   print(df.groupby('status').total.sum())

2. sandbox/runner.py:
   - Loads session_store[session_id] → DataFrames
   - Writes runner script to tempfile with:
       - Blocked import hook (os, subprocess, sys, socket, shutil)
       - df = <merged result DataFrame>
       - df_users_db = <users sub-result DataFrame>
       - df_orders_db = <orders sub-result DataFrame>
       - exec(user_code)
   - subprocess.run([python, tempfile], timeout=30, capture_output=True)
   - Returns stdout / stderr to browser
```

---

## 4. Component Details

### 4a. config.py
- Loads `connections.yaml`
- Interpolates `${ENV_VAR}` patterns from environment variables
- Validates with Pydantic:
  ```
  AppConfig
    └─ environments: dict[str, EnvironmentConfig]
         └─ databases: dict[str, DatabaseConfig]
              └─ host, port, dbname, user, password
  ```
- Raises clear errors if required fields are missing or env vars unset

### 4b. connections.py — Connection Manager
- Holds one `asyncpg.Pool` per `(env, db_name)` pair
- `switch_env(env)`: creates pools for all DBs in env, closes old pools
- `get_pool(db_name)`: returns pool for a DB in the current env
- `probe_all()`: runs `SELECT 1` on each pool → returns `{db_name: "ok"|"error"}`
- Pools created on environment switch, never per-request

### 4c. query/parser.py — SQL Parser
Uses `sqlglot` (PostgreSQL dialect). Core function:

```python
def parse_query(sql: str, known_dbs: set[str]) -> QueryPlan
```

**`QueryPlan` dataclass:**
- `sub_queries: list[SubQuery]` — one per DB referenced, each with rewritten SQL + alias map
- `merge_sql: str` — original SQL with `db_name.` prefix stripped (for DuckDB)
- `referenced_dbs: set[str]`

**Predicate pushdown rules:**
- Walk the WHERE clause AST
- A predicate is "pushable to DB X" if every column reference in it resolves to a table alias belonging to DB X only
- Pushable predicates go into the sub-query WHERE; cross-DB conditions stay only in DuckDB merge

**Error conditions:**
- `db_name` in SQL not in `known_dbs` → `ParseError("Unknown database: {db_name}. Available: {known_dbs}")`
- Same table name in two DBs without `db_name.` prefix → `ParseError("Ambiguous table: {name}. Qualify with db_name.{name}")`
- Single-DB query (no cross-DB refs) → passthrough directly to that DB, skip DuckDB

### 4d. query/executor.py — Query Executor

```python
async def execute_query(
    plan: QueryPlan,
    manager: ConnectionManager,
    row_limit: int = 50_000
) -> QueryResult
```

Steps:
1. `EXPLAIN (FORMAT JSON)` each sub-query → extract `Plan Rows`; if any > `row_limit` raise `RowLimitError`
2. `asyncio.gather(*[_run_sub(sq) for sq in plan.sub_queries])`
3. Register each result in a fresh DuckDB connection as named tables (by alias to avoid name collisions across DBs)
4. Execute `plan.merge_sql` → DuckDB result → dict rows
5. Store in `session_store[session_id]`
6. Return `QueryResult(rows, columns, row_count, timing_ms_per_db, session_id)`

### 4e. query/schema.py — Schema Fetcher
- Queries `information_schema.tables` + `information_schema.columns` for each DB in current env
- Returns `SchemaCache: dict[db_name, dict[table_name, list[column_name]]]`
- Called on environment switch, cached until next switch
- Powers frontend autocomplete

### 4f. sandbox/runner.py — Python Sandbox

```python
def run_python(code: str, session_id: str, timeout: int = 30) -> SandboxResult
```

- Load DataFrames from `session_store[session_id]`; serialize to pickle, pass path via env var
- Subprocess runner script sets `__builtins__.__import__` hook blocking:
  `{"os", "subprocess", "sys", "socket", "shutil", "pty", "ctypes", "multiprocessing", "importlib"}`
- Injects `df`, `df_{db_name}` variables from pickled DataFrames
- `exec(user_code)` with stdout captured
- Returns `SandboxResult(output: str, error: str | None)`

### 4g. main.py — FastAPI App
- Lifespan: load config → initialize ConnectionManager → load schema for first env
- CORS: allow `http://localhost:5173`
- All shared state on `app.state`

**Endpoints:**
```
GET  /api/environments
     → { environments: ["dev", "staging", "production"] }

POST /api/environments/switch
     body: { env: "production" }
     → { status: { users_db: "ok", orders_db: "error" }, schema: SchemaCache }

GET  /api/schema
     → SchemaCache for current env

POST /api/query/run
     body: { sql: "...", session_id: "uuid" }
     → { rows: [...], columns: [...], row_count: N, timing: {...}, session_id: "uuid" }
     or { error: "...", detail: "...", code: "PARSE_ERROR|ROW_LIMIT_EXCEEDED|CONNECTION_ERROR|TIMEOUT" }

POST /api/python/run
     body: { code: "...", session_id: "uuid" }
     → { output: "...", error: null }
```

---

## 5. Frontend Design

### Layout
```
┌─────────────────────────────────────────────────┐
│  DB Simplifier          [env: production ▼]      │  ← topbar
│                         ● users_db  ● orders_db  │    (green/red dots)
├─────────────────────────────────────────────────┤
│                                                   │
│  SELECT u.name, o.total                          │  ← QueryEditor (CodeMirror SQL)
│  FROM users_db.users u                           │    Cmd+Enter to run
│  JOIN orders_db.orders o ON u.id = o.user_id     │
│  WHERE o.status = 'paid'                         │
│                                              ▶ Run│
├─────────────────────────────────────────────────┤
│  1,240 rows · users_db: 45ms · orders_db: 38ms  │  ← ResultsTable
│  name          total                             │    client-side sort
│  Alice         299.00                            │
│  Bob           149.00                            │
├─────────────────────────────────────────────────┤
│  ▼ Python Analysis                               │  ← PythonCell (collapsible)
│  print(df.groupby('name').total.sum())           │
│  ─────────────── output ──────────────────────  │
│  Alice    299.0                                  │
│  Bob      149.0                                  │
└─────────────────────────────────────────────────┘
```

### Zustand Store Shape
```typescript
interface AppStore {
  environments: string[]
  activeEnv: string | null
  dbStatus: Record<string, 'ok' | 'error'>
  schema: SchemaCache | null
  sessionId: string           // persisted in localStorage
  queryResult: QueryResult | null
  isQuerying: boolean
  queryError: AppError | null
  pythonOutput: string | null
  isPythonRunning: boolean
  // actions
  switchEnv: (env: string) => Promise<void>
  runQuery: (sql: string) => Promise<void>
  runPython: (code: string) => Promise<void>
}
```

### Components
- **EnvSwitcher**: dropdown + colored badge per DB (green = ok, red = error)
- **QueryEditor**: CodeMirror 6, PostgreSQL dialect, autocomplete (db → table → column), Cmd+Enter, error annotations
- **ResultsTable**: `@tanstack/react-table`, column sort, row count + timing header, row-limit warning banner
- **PythonCell**: collapsible, CodeMirror 6 Python, output renders DataFrame as HTML table or `<pre>`, errors in red

---

## 6. connections.yaml Format

```yaml
environments:
  development:
    databases:
      users_db:
        host: localhost
        port: 5432
        dbname: users
        user: dev_user
        password: dev_pass
      orders_db:
        host: localhost
        port: 5433
        dbname: orders
        user: dev_user
        password: dev_pass
  production:
    databases:
      users_db:
        host: prod-db.internal
        port: 5432
        dbname: users
        user: readonly_user
        password: "${PROD_DB_PASSWORD}"
```

`connections.yaml` → gitignored. `connections.example.yaml` → committed (no real values).

---

## 7. Error Handling

| Scenario | Code | User Message |
|---|---|---|
| Unknown `db_name.` prefix | `PARSE_ERROR` | "Unknown database: 'foo'. Available: users_db, orders_db" |
| Ambiguous table name | `PARSE_ERROR` | "Table 'orders' exists in both users_db and orders_db. Use db_name.orders" |
| DB connection fails | `CONNECTION_ERROR` | "Could not connect to orders_db" |
| Row estimate exceeds limit | `ROW_LIMIT_EXCEEDED` | "orders_db sub-query estimates 2.1M rows (limit: 50k). Add a WHERE filter." |
| Query timeout (>60s) | `TIMEOUT` | "Query exceeded 60s timeout" |
| Sandbox timeout | `SANDBOX_ERROR` | "Python execution exceeded 30s" |
| Blocked import | `SANDBOX_ERROR` | "Import of 'os' is not allowed in the sandbox" |
| Python before query | `SANDBOX_ERROR` | "Run a query first to load data into the Python cell" |

---

## 8. Testing Strategy

**Backend unit tests** (no Docker needed):
- `test_parser.py`: cross-DB JOIN parse, predicate pushdown, single-DB passthrough, ambiguous table, unknown DB
- `test_config.py`: YAML loading, env var interpolation, missing field errors
- `test_sandbox.py`: blocked imports, timeout kill, DataFrame injection, stdout capture

**Backend integration tests** (`testcontainers`):
- `test_executor.py`: 2 real PostgreSQL containers with seed data, verify cross-DB JOIN result
- `test_api.py`: full endpoint tests via `httpx.AsyncClient`

**Frontend** (`vitest` + `@testing-library/react`):
- EnvSwitcher renders and calls switchEnv
- ResultsTable renders rows, sorts, shows warning banner

**E2E** (`playwright`):
- Switch env → run cross-DB query → see results → run Python → see output

---

## 9. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| SQL/Python Editor | CodeMirror 6 |
| State | Zustand |
| Results Table | @tanstack/react-table |
| Backend | Python 3.12, FastAPI |
| PostgreSQL Driver | asyncpg |
| SQL Parser | sqlglot |
| In-memory Engine | DuckDB |
| Config | PyYAML + Pydantic v2 |
| Python Sandbox | subprocess + custom import hook |
| Backend Tests | pytest, pytest-asyncio, testcontainers |
| Frontend Tests | vitest, @testing-library/react |
| E2E Tests | Playwright |
| Dev DBs | Docker + docker-compose |
| Dependency Mgmt | uv (Python), npm (JS) |

---

## 10. Known Constraints

- **Predicate pushdown scope**: Only simple column comparison predicates are pushed (`col = val`, `col > val`). Subqueries in WHERE, `EXISTS`, `IN (subselect)` with cross-DB refs run entirely in DuckDB.
- **DuckDB table registration**: Tables are registered by alias (not name) to handle cases where two DBs have a table with the same name. Parser must ensure all referenced tables have explicit aliases.
- **EXPLAIN estimates**: PostgreSQL row estimates can be inaccurate on tables with stale statistics. The limit is a safety net, not a precise count.
