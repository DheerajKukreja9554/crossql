# CrossQL Phase 2b — Manage Connections UI

## Overview

Phase 2b adds the frontend for runtime connection management. All backend endpoints already exist (`/api/connections` CRUD + `/api/connections/test`). This phase is entirely frontend work: one new modal component, minor TopBar additions, and API wiring.

**Goal:** Let users add, edit, and remove PostgreSQL environments from the UI without touching `connections.yaml` manually.

---

## 1. Access Point

A gear icon button (`⚙`) is added to the TopBar, between the environment pill and the theme toggle. Clicking it opens `ManageConnectionsModal`. This is always visible — no dropdown nesting.

**Files changed:**
- `frontend/src/components/TopBar.tsx` — add gear button, accept `onManageConnections: () => void` prop
- `frontend/src/App.tsx` — hold `manageConnectionsOpen: boolean` state, render modal, pass handler to TopBar

---

## 2. ManageConnectionsModal Component

**File:** `frontend/src/components/ManageConnectionsModal.tsx`

Self-contained component. All view state (`"list" | "add" | "edit"`) is local — no Zustand changes needed. After any save or delete it calls `store.reloadConfig()` to refresh the env list and schema in the rest of the app.

### 2.1 List View

Rendered on mount. Calls `GET /api/connections` to populate.

**Per environment card:**
- Name, host, port, user
- Status badges: `active` (current env), `connected` / `needs_reauth`
- DB count badge (from `discovered_dbs` after a successful switch, or omitted if unknown)
- **Edit button** → switches to edit view with form pre-filled
- **Delete button** → hidden on the active environment card; on others, shows a confirmation inline ("Delete [name]? This cannot be undone. [Cancel] [Delete]")

**Re-auth state** (`needs_reauth: true`):
- Card gets yellow border + `⚠ re-auth needed` badge
- Inline row below the host: lock icon + "Re-enter password:" label + password input + "Unlock" button
- Unlock → `PUT /api/connections/:env` with `{ password }` only → on success: re-fetch list, badge clears
- Unlock fails → input border turns red + "Incorrect password" message

**"Add environment" button** at the bottom of the list → switches to add view.

### 2.2 Add Form

Fields:
| Field | Type | Notes |
|---|---|---|
| Display name | text | Required. Used as the environment key in `connections.yaml` |
| Host | text | Required |
| Port | number | Default 5432 |
| Username | text | Required |
| Password | password | Required for add |

**"Test connection" button** → `POST /api/connections/test`:
- Success: green banner "Connected — N databases discovered" + DB chips (see §2.3)
- Failure: red banner with the error message from the backend

**Save** → `POST /api/connections` with `{ name, host, port, user, password, exclude_databases }` → on success: `reloadConfig()`, close modal.

Save button is disabled until all required fields are filled. It does not require a successful test first (user may want to save and test later).

### 2.3 Exclude Databases Selector

Shown below the test success banner. Only appears after a successful test.

- All discovered databases rendered as clickable chips
- Default: all included (blue chip)
- Click to toggle: excluded chips get strikethrough + muted style
- System DBs (`postgres`, `template0`, `template1`, etc.) are never shown — backend already excludes them
- The current `exclude_databases` array (from edit pre-fill) sets initial excluded state
- Hint text: "Click a database to exclude it from the sidebar and autocomplete"

### 2.4 Edit Form

Same fields as add, except:
- **Display name field is read-only** (shown as plain text, not an input — renaming an env requires delete + re-add since it's the YAML key)
- **Password field placeholder:** "Leave blank to keep current password" — only included in the PATCH body if non-empty
- Pre-filled with current values from the list
- "Test connection" button works the same way
- DB chips pre-filled with current `exclude_databases` from the connection record (requires backend to return this — add `exclude_databases: string[]` to `ConnectionInfo` model)

**Save** → `PUT /api/connections/:env` → `reloadConfig()`, back to list.

---

## 3. API Client Additions

**File:** `frontend/src/api/client.ts`

```typescript
export interface ConnectionInfo {
  name: string;
  host: string;
  port: number;
  user: string;
  has_password: boolean;
  needs_reauth: boolean;
  exclude_databases: string[];   // add this field
}

export interface TestConnectionResult {
  status: "ok" | "error";
  discovered_dbs: string[];
  error?: string;
}

// New calls:
api.getConnections(): Promise<{ environments: ConnectionInfo[] }>
api.testConnection(body: { host, port, user, password }): Promise<TestConnectionResult>
api.createConnection(body: { name, host, port, user, password, exclude_databases }): Promise<{ name, status, discovered_dbs }>
api.updateConnection(name: string, patch: Partial<{ host, port, user, password, exclude_databases }>): Promise<{ name, status, discovered_dbs }>
api.deleteConnection(name: string): Promise<{ deleted: boolean }>
```

---

## 4. Backend Change (minor)

**File:** `backend/models.py`

Add `exclude_databases: list[str] = []` to `ConnectionInfo` so the edit form can pre-fill the chip state.

**File:** `backend/main.py`

Update `list_connections` to include `exclude_databases` from `env_cfg`:
```python
ConnectionInfo(
    ...
    exclude_databases=cfg.exclude_databases,
)
```

---

## 5. Styles

**File:** `frontend/src/styles.css`

New classes needed (following existing naming conventions):
- `.modal-overlay` — fixed inset, dark backdrop, flex center
- `.modal` — white-card panel, `640px` wide, `max-height: 82vh`, flex column
- `.modal-header`, `.modal-body`, `.modal-footer` — standard sections
- `.conn-card` — environment card in list view
- `.conn-card.reauth` — yellow border variant
- `.reauth-row` — inline password prompt inside card
- `.db-chips` — flex-wrap chip container
- `.db-chip`, `.db-chip.included`, `.db-chip.excluded` — chip states

---

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| Test connection fails | Red inline banner in form. Form stays open. |
| Save (add/edit) fails | Error text below Save button. Form stays open. |
| Delete active env | Delete button not rendered on active env card. |
| Re-auth unlock fails | Password input border red + "Incorrect password" inline. |
| Network error on load | "Could not load connections" message in modal body with retry button. |

---

## 7. Files Summary

| File | Change |
|---|---|
| `frontend/src/components/ManageConnectionsModal.tsx` | **New** — full modal with list/add/edit views |
| `frontend/src/components/TopBar.tsx` | Add gear button + `onManageConnections` prop |
| `frontend/src/App.tsx` | `manageConnectionsOpen` state + render modal |
| `frontend/src/api/client.ts` | Add 5 connection API methods + `ConnectionInfo.exclude_databases` |
| `frontend/src/styles.css` | Modal + card styles |
| `backend/models.py` | Add `exclude_databases` to `ConnectionInfo` |
| `backend/main.py` | Pass `exclude_databases` in `list_connections` |
