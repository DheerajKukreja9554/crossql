# DB Simplifier — Requirements Document

## Problem Statement

Working across a microservice architecture with multiple PostgreSQL databases per environment is painful:

1. **Connection switching friction** — DBeaver requires manually reconnecting to query a different database, even within the same environment.
2. **No cross-DB querying** — Data is related across microservice DBs within a single environment, but native SQL JOINs across PostgreSQL databases are not possible.
3. **Manual analysis workflow** — Verifying or analyzing data across DBs requires exporting results to files and importing them into a Python script — slow and error-prone.
4. **Existing tools have lag** — Tools like Clickhouse and Metabase replicate data with a 3+ hour lag, making them unsuitable for real-time verification and sanity checks.

---

## Target User (Phase 1)

- Single engineer (yourself)
- Comfortable with SQL and Python/pandas
- Works across 5–6 environments (dev, staging, prod, etc.)
- Each environment has multiple PostgreSQL databases (one per microservice)

---

## Environment Model

```
Environment (e.g., "production")
├── users_db        (PostgreSQL)
├── orders_db       (PostgreSQL)
├── payments_db     (PostgreSQL)
└── inventory_db    (PostgreSQL)
```

- Data within one environment is **related** across DBs (can be joined/compared)
- Data across environments is **independent** (no cross-env joins needed)
- One active environment at a time

---

## Phase 1 — Local Single-User Web App (MVP)

### Goals
- Replace the DBeaver multi-connection workflow for cross-DB queries
- Eliminate the manual export-to-Python analysis step
- Real-time data — no replication lag

### Features

#### 1. Environment & Connection Management
- Connections defined in a local `connections.yaml` file
- Each environment lists its databases (host, port, dbname, credentials)
- Top-level environment switcher in the UI (dropdown)
- On environment switch, backend validates all connections before proceeding
- Connections are **not** editable at runtime in Phase 1

#### 2. Cross-DB SQL Query Editor
- Write a single SQL query that references tables from multiple DBs using `db_name.table` or `db_name.schema.table` notation
- Backend parses the query to identify which tables belong to which DB
- **Predicate pushdown**: WHERE clauses applicable to individual tables are pushed down to PostgreSQL before data is pulled into memory (avoids loading unnecessary rows)
- Sub-queries execute in **parallel** against each PostgreSQL DB (asyncpg)
- Results are loaded into an in-memory DuckDB instance
- The full merged query executes in DuckDB and returns unified results
- **Row limit safeguard**: configurable cap per DB sub-query (default: 50,000 rows). Warning shown if a sub-query approaches or exceeds the limit — user must add filters before proceeding.

#### 3. SQL Autocomplete
- Table names and column names fetched from each DB's `information_schema`
- DB name prefix autocomplete (e.g., typing `orders_db.` suggests tables)
- Powered by CodeMirror in the frontend

#### 4. Results View
- Paginated table view of query results
- Column sorting and basic filtering in the UI
- Row count and query execution time displayed

#### 5. Python Analysis Cell
- Appears below query results
- Query results automatically exposed as:
  - `df` — the merged/full result as a pandas DataFrame
  - `df_{db_name}` — individual DB results as DataFrames
- User writes Python/pandas code in an editor cell
- Executes in a sandboxed subprocess (no filesystem access, execution timeout enforced)
- Output rendered as a table (for DataFrames) or plain text (for prints)

### Tech Stack
- **Frontend**: React, CodeMirror (SQL + Python editors)
- **Backend**: Python, FastAPI
- **PostgreSQL driver**: asyncpg (async, parallel queries)
- **In-memory engine**: DuckDB (cross-DB merging and SQL execution)
- **Python sandbox**: subprocess with restricted environment
- **Config**: `connections.yaml` (local file, not committed to version control)

### Out of Scope for Phase 1
- User authentication
- Multi-user access
- Runtime connection management (add/edit/remove connections via UI)
- Non-PostgreSQL databases
- Query history persistence
- Saved notebooks
- Charts or visualizations
- Desktop app packaging

---

## Phase 2 — Team Access + Runtime Connections

### Goals
- Allow teammates to use the tool without editing config files
- Make connection management self-serve via the UI

### Planned Features
- **Runtime connection management**: Add, edit, remove database connections from the UI without restarting
- **Multi-user support**: Basic authentication (username/password), user sessions
- **Connection sharing**: Shared environment configs accessible to all users
- **Query history**: Persist recent queries per user
- **Saved queries**: Name and save frequently used queries

---

## Phase 3 — Desktop App (macOS)

### Goals
- Distribute as a native macOS app for better developer experience

### Planned Features
- **macOS desktop app**: Package web app using Tauri (preferred) or Electron
- **System tray integration**: Quick launch, environment indicator
- **Local credential storage**: Secure keychain integration for DB passwords
- **Offline support**: App works without internet, connects directly to DBs

---

## Phase 4 — Extended Database & Analysis Support

### Goals
- Broader database support and richer analysis capabilities

### Planned Features
- **Additional databases**: MySQL, MongoDB, Redis read support
- **Visualizations**: Charts (bar, line, scatter) rendered from query results
- **Export**: Download results as CSV, Excel, or JSON
- **Notebook format**: Save and share SQL + Python notebooks as files
- **Query performance insights**: Execution plan viewer, slow query warnings

---

## Success Criteria (Phase 1)

- Can switch between environments in one click
- Can write a single SQL query joining tables from two different microservice DBs and get a result in under 5 seconds (for reasonably filtered queries)
- Can run Python/pandas analysis on query results without leaving the tool
- Prod queries are safe: row limit warnings prevent accidental full-table scans
