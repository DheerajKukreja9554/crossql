# CrossQL Phase 2 — Design Spec

## Overview

Phase 2 adds five features to CrossQL, prioritized by daily pain points:

1. **Runtime connection management** — add/edit/remove environments from the UI with encrypted credentials
2. **Query tabs** — multiple SQL panes with independent results
3. **Execute at cursor** — run the statement where cursor sits, DBeaver-style
4. **Saved queries + auto-history** — persistent query library + lightweight run log
5. **Performance optimizations** — lazy pools, debounced autocomplete, schema caching

Architecture approach: **Hybrid** — backend handles data persistence (connections, saved queries, encryption). Frontend handles UI state (tabs, cursor logic, auto-history in localStorage).

---

## 1. Runtime Connection Management

### 1.1 Encrypted Credentials

Passwords are encrypted at rest in `connections.yaml` using Fernet symmetric encryption.

**Key derivation:**
- Input: `platform.node()` + OS username + fixed salt `"crossql-v1"`
- Algorithm: PBKDF2-HMAC-SHA256, 100k iterations → 32-byte key → Fernet
- Key derived on startup, held in memory only

**YAML format:**
```yaml
environments:
  sandbox:
    host: vegapay-sandbox-postgres-server.postgres.database.azure.com
    port: 5432
    user: postgres
    password_encrypted: "gAAAAABm..."   # Fernet-encrypted
  development:
    host: localhost
    port: 5434
    user: dev_user
    password: dev_pass                   # plaintext still supported (backwards compat)
```

**Resolution order:** `password_encrypted` takes priority over `password`. If encrypted field exists, `password` field is ignored.

**Machine key change** (new hostname/username): encrypted passwords become undecryptable. Backend detects this (Fernet raises `InvalidToken`) and marks the environment as needing re-authentication. UI shows "Re-enter password" prompt.

### 1.2 Config Module Changes

`backend/config.py`:
- `EnvironmentConfig` gains optional `password_encrypted: str | None` field
- New `resolved_password()` method: tries `password_encrypted` first (decrypt), falls back to `password` (plaintext/env-var)
- New `encrypt_password(plaintext) → str` module-level function
- New `save_config(config, path)` function that writes back to YAML

`backend/encryption.py` (new file):
- `get_machine_key() → bytes` — derives Fernet key from machine identity
- `encrypt(plaintext: str) → str` — Fernet encrypt, returns base64 string
- `decrypt(ciphertext: str) → str` — Fernet decrypt, raises `InvalidToken` on failure

### 1.3 API Endpoints

```
GET    /api/connections
       → { environments: [{ name, host, port, user, has_password: bool, needs_reauth: bool }] }

POST   /api/connections/test
       body: { host, port, user, password, ssl?: bool }
       → { status: "ok" | "error", discovered_dbs: string[], error?: string }
       Side effect: none (test only, does not save)

POST   /api/connections
       body: { name, host, port, user, password, ssl?: bool, exclude_databases?: string[] }
       → { name, status: "ok" | "error", discovered_dbs: string[] }
       Side effect: encrypts password, writes to connections.yaml, creates pools

PUT    /api/connections/:env
       body: { host?, port?, user?, password?, ssl?, exclude_databases? }
       → { name, status, discovered_dbs }
       Side effect: re-encrypts if password changed, updates YAML, reconnects pools

DELETE /api/connections/:env
       → { deleted: true }
       Side effect: closes pools, removes from YAML
       Guard: cannot delete the active environment (switch first)
```

### 1.4 Frontend: Manage Connections Modal

Accessed from: env switcher dropdown → "Manage connections" link at bottom.

**Modal flow:**
1. **List view** — all environments as cards (host, user, status dot, DB count). Edit/delete buttons per card. "Add environment" button.
2. **Add/Edit form** — fields: display name, host, port, user, password, SSL toggle. "Test & Discover" button that hits `POST /api/connections` with a dry-run flag → shows discovered databases. "Save" commits.
3. **Delete** — confirmation dialog. If active env, prompt to switch first.

---

## 2. Query Tabs

### 2.1 State Model

Managed in Zustand store, persisted to `localStorage` key `crossql-tabs`:

```typescript
interface QueryTab {
  id: string;              // uuid
  name: string;            // "query_1.sql" or user-renamed
  sql: string;             // editor content
  dirty: boolean;          // modified since last save
  cursorPos: number;       // last cursor position
}

// Store additions:
tabs: QueryTab[];
activeTabId: string;
queryResults: Record<string, QueryResult>;   // tabId → result
queryErrors: Record<string, AppError>;       // tabId → error
```

### 2.2 Behavior

- **TopBar** shows tabs: dirty dot (yellow), tab name, close button. `+` button creates new tab.
- **New tab** named `query_N.sql` (N = next available number).
- **Close dirty tab** → prompt "Save to Saved Queries before closing?" with Save / Discard / Cancel.
- **Double-click tab name** → inline rename.
- **Tab content auto-saved** to localStorage on every change (survives browser refresh).
- **Results scoped per tab** — switching tabs shows that tab's result (or empty state).
- **Python cell scoped per tab** — each tab's result is independently available as `df`.
- **Max 10 tabs** open simultaneously.
- **Close last tab** → auto-create a blank one (always at least 1 tab).
- **Browser refresh** → tabs restored from localStorage, results are gone (re-run needed).

### 2.3 Session Store Impact

Backend `session_store` key changes from `session_id` to `session_id:tab_id` to support per-tab Python cell access. Frontend sends `session_id + ":" + activeTabId` as the session identifier.

---

## 3. Execute at Cursor

### 3.1 Statement Detection

Entirely frontend logic in `QueryEditor.tsx`.

On **Cmd+Enter**:
1. If text is **selected** → run the selection.
2. If no selection, **find the statement at cursor**:
   - Scan backwards from cursor position to find start: previous `;` (outside quotes/comments) or start of text.
   - Scan forwards to find end: next `;` (outside quotes/comments) or end of text.
   - Trim whitespace. If result is empty or comment-only, skip to the nearest real statement.
3. If **no semicolons** in the entire pane → run everything (current behavior).

**Quote-aware scanning** — track single-quote (`'`) and double-quote (`"`) state during the scan so semicolons inside string literals (`WHERE name = 'foo;bar'`) are not treated as delimiters.

### 3.2 Visual Feedback

The statement at cursor gets a subtle background highlight (`var(--bg-2)` with 50% opacity) via a CodeMirror decoration. Updates on cursor movement (debounced 100ms for performance).

### 3.3 Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+Enter` | Run statement at cursor (or selection) |
| `Cmd+Shift+Enter` | Run entire pane (all statements) |

---

## 4. Saved Queries + Auto-History

### 4.1 Saved Queries

**Storage:** `~/.crossql/saved_queries.json` (backend manages read/write).

```json
[
  {
    "id": "uuid",
    "name": "High-value txns by risk tier",
    "sql": "SELECT c.risk_tier, SUM(t.amount)...",
    "folder": "analytics",
    "created_at": "2026-04-27T10:00:00Z",
    "updated_at": "2026-04-27T10:30:00Z"
  }
]
```

**Backend endpoints:**
```
GET    /api/queries           → { queries: SavedQuery[] }
POST   /api/queries           → { query: SavedQuery }
PUT    /api/queries/:id       → { query: SavedQuery }
DELETE /api/queries/:id       → { deleted: true }
```

**Backend behavior:**
- `~/.crossql/` directory created on first save if missing.
- Corrupted JSON → log warning, back up as `.bak`, start fresh.
- Duplicate names allowed (identified by UUID).

**Frontend — sidebar tabs:**
```
[ Databases ] [ Saved Queries ]
```

**Saved Queries tab shows:**
- Flat list grouped by folder (collapsible folder headers)
- Each entry: name, first line of SQL preview, updated timestamp
- Click → opens in a new query tab
- `...` menu per entry → rename, delete, move to folder
- "Save" button (floppy disk icon) in the editor header bar → saves current tab's SQL

**Save flow:**
- Click save → if tab has no linked saved query, prompt for name + optional folder → `POST /api/queries`
- If tab is already linked to a saved query → `PUT /api/queries/:id` (silent update)

### 4.2 Auto-History

**Storage:** `localStorage` key `crossql-history`, capped at 50 entries (FIFO).

```json
[
  {
    "sql": "SELECT ac.* FROM...",
    "env": "sandbox",
    "timestamp": "2026-04-27T10:42:00Z",
    "rowCount": 10,
    "ms": 923,
    "success": true
  }
]
```

**Frontend behavior:**
- Every `runQuery` call auto-appends to history (before the API call, so even failed queries are logged).
- No dedicated UI panel. History entries appear as a "Recent" section at the top of the Saved Queries sidebar tab (collapsed by default, last 10 shown).
- Click a history entry → opens in a new tab.

---

## 5. Performance Optimizations

### 5.1 Lazy Connection Pools

**Current:** On env switch, create asyncpg pools for ALL discovered databases concurrently.

**New:** On env switch, only discover databases (one connection to `postgres` DB). Pools created on-demand:
- First query referencing `account_management` → create pool, cache it
- First sidebar expand of `ledger` → fetch schema for that DB, create pool

**ConnectionManager changes:**
- `switch_env()` runs discovery only, no pool creation. Returns discovered DBs with status "discovered" (not "ok").
- `get_pool(db_name)` becomes async: if pool doesn't exist, creates it on the fly, caches for session.
- `get_schema(db_name)` new method: fetches schema for a single DB (on demand).
- Status bar shows: "44 DBs discovered · 2 connected"

**Schema fetcher changes:**
- `fetch_schema(manager)` replaced by `fetch_schema_for_db(manager, db_name)` — single-DB fetch.
- Full schema loaded incrementally as DBs are expanded in sidebar or referenced in queries.

### 5.2 Debounced Autocomplete

**Current:** `extensions` useMemo depends on `value` (SQL text) → entire extension set rebuilds on every keystroke.

**Fix:** Move alias parsing into the completion source function:
- `extensions` depends only on `schema` (changes on env switch, not on typing)
- Completion source reads current SQL text from a `useRef` (always up to date, no re-render)
- Alias parsing runs only when autocomplete popup activates (user types `.` or triggers manually)

### 5.3 Schema Caching

**Cache location:** `localStorage` key `crossql-schema-{env}`.

**Flow:**
1. Env switch → load cached schema instantly → display in sidebar
2. Background: fetch fresh schema from backend
3. Diff → update sidebar + autocomplete if changed
4. "Refresh" button forces immediate fresh fetch

**Staleness:** Cache is a convenience for instant display. Autocomplete uses whatever is available. Schema rarely changes in practice.

---

## 6. Error Handling + Edge Cases

### Connection Management
- Test connection fails → error shown inline in modal, entry not saved
- Delete active environment → blocked, prompt to switch first
- Both `password:` and `password_encrypted:` present → encrypted takes priority
- Machine key changes → `InvalidToken` on decrypt → environment marked `needs_reauth: true` → UI prompts for password re-entry

### Query Tabs
- Close last tab → auto-create blank tab (always ≥ 1)
- Browser refresh → tabs restored from localStorage, results gone (re-run needed)
- Max 10 tabs → "+" button disabled with tooltip "Close a tab to open a new one"

### Execute at Cursor
- Cursor in a comment-only block → find nearest real statement
- Empty statement (whitespace between semicolons) → skip
- Semicolons inside string literals → handled by quote-state tracking during scan

### Saved Queries
- `~/.crossql/` missing → created on first save
- `saved_queries.json` corrupted → backed up as `.bak`, start fresh
- Duplicate names → allowed (UUID-identified)

---

## 7. New Files Summary

**Backend:**
```
backend/encryption.py          Machine-key Fernet encryption
backend/queries.py             Saved queries CRUD (JSON file manager)
```

**Frontend:**
```
frontend/src/components/ManageConnectionsModal.tsx
frontend/src/components/SavedQueriesPanel.tsx
frontend/src/lib/statementAtCursor.ts        Statement detection logic
frontend/src/lib/queryHistory.ts             localStorage history helper
```

**Modified (significant):**
```
backend/config.py              password_encrypted field, save_config()
backend/connections.py         Lazy pools, on-demand schema
backend/main.py                New CRUD endpoints for connections + saved queries
backend/models.py              New request/response models
frontend/src/store/useAppStore.ts   Tabs, per-tab results, new actions
frontend/src/components/TopBar.tsx   Tab bar
frontend/src/components/Sidebar.tsx  Databases/Saved Queries toggle
frontend/src/components/QueryEditor.tsx  Execute-at-cursor, debounced autocomplete
```
