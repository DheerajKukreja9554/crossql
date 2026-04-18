# DB Simplifier

A local web app for engineers working across microservice architectures. Query multiple PostgreSQL databases with a single SQL statement, analyze results with Python — no connection switching, no data export, no replication lag.

## The Problem

In a microservice architecture, data lives in separate PostgreSQL databases. Joining `users_db.users` with `orders_db.orders` isn't possible natively — you'd need to export data, write Python scripts, or use tools like Metabase that introduce hours of lag.

## What This Does

- **Write one query spanning multiple DBs** using `db_name.table` notation
- **Switch environments** (dev/staging/prod) in one click
- **Real-time data** — queries your actual databases, no replication
- **Python analysis cell** — results are auto-exposed as pandas DataFrames
- **Safe for prod** — row limit safeguard prevents accidental full-table scans

## Example

```sql
SELECT u.name, o.total, o.status
FROM users_db.users u
JOIN orders_db.orders o ON u.id = o.user_id
WHERE u.active = true AND o.status = 'paid'
ORDER BY o.total DESC
```

Then in the Python cell:
```python
print(df.groupby('status').total.sum())
print(df_users_db.shape)  # individual DB result also available
```

## Setup

### Requirements
- Python 3.12+
- Node.js 18+
- Docker (for local dev databases)
- `uv` (`pip install uv`)

### Install

```bash
# Clone
git clone https://github.com/yourusername/db-simplifier
cd db-simplifier

# Install dependencies
make install

# Configure your databases
cp connections.example.yaml connections.yaml
# Edit connections.yaml with your DB credentials

# Start local test databases (optional, for dev)
make db-up

# Start the app
make dev
# → Backend: http://localhost:8000
# → Frontend: http://localhost:5173
```

## How It Works

```
Browser → FastAPI → sqlglot parser → asyncpg (parallel) → DuckDB merge → result
                                     └─ users_db ─┘
                                     └─ orders_db ─┘
```

1. SQL is parsed to identify which tables belong to which database
2. WHERE predicates are pushed down to each PostgreSQL DB (only filtered rows pulled into memory)
3. Sub-queries run in parallel, results merged in DuckDB
4. Python cell runs in a sandboxed subprocess with results as DataFrames

## Configuration

`connections.yaml` (gitignored — never commit credentials):

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

## Roadmap

- **Phase 1** (current): Single-user local web app
- **Phase 2**: Team access, runtime connection management, query history
- **Phase 3**: macOS desktop app (Tauri)
- **Phase 4**: Additional databases, charts, export, notebooks

## Tech Stack

Backend: Python + FastAPI + asyncpg + sqlglot + DuckDB + pandas  
Frontend: React + TypeScript + Vite + CodeMirror 6 + Zustand  
Tests: pytest + testcontainers + Playwright
