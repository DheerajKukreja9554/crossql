# Phase 2b — Manage Connections UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Manage Connections modal so users can add, edit, and remove PostgreSQL environments from the UI without touching `connections.yaml` manually.

**Architecture:** A self-contained `ManageConnectionsModal` component holds all view state locally (`list | add | edit`). It calls the backend API directly and triggers `store.reloadConfig()` after mutations. A gear icon in TopBar opens it. All backend CRUD endpoints already exist — this is almost entirely frontend work plus two minor backend lines.

**Tech Stack:** React 18, TypeScript, Zustand (read-only — no store changes), FastAPI backend (already done), `frontend/src/api/client.ts` fetch wrappers.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/models.py` | Modify | Add `exclude_databases: list[str] = []` to `ConnectionInfo` |
| `backend/main.py` | Modify | Pass `exclude_databases=cfg.exclude_databases` in `list_connections` |
| `frontend/src/api/client.ts` | Modify | Add `ConnectionInfo` interface + 5 connection API methods |
| `frontend/src/styles.css` | Modify | Modal overlay, connection cards, DB chips, re-auth row |
| `frontend/src/components/ManageConnectionsModal.tsx` | Create | Full modal: list / add / edit views |
| `frontend/src/components/TopBar.tsx` | Modify | Add gear button + `onManageConnections` prop |
| `frontend/src/App.tsx` | Modify | `manageConnectionsOpen` state + render modal |

---

## Task 31: Backend — expose `exclude_databases` in ConnectionInfo

**Files:**
- Modify: `backend/models.py:116-122`
- Modify: `backend/main.py` (`list_connections` function)

- [ ] **Step 1: Add field to `ConnectionInfo` in `backend/models.py`**

Find this class (currently around line 116):
```python
class ConnectionInfo(BaseModel):
    name: str
    host: str
    port: int
    user: str
    has_password: bool
    needs_reauth: bool
```
Replace with:
```python
class ConnectionInfo(BaseModel):
    name: str
    host: str
    port: int
    user: str
    has_password: bool
    needs_reauth: bool
    exclude_databases: list[str] = []
```

- [ ] **Step 2: Pass the field in `list_connections` in `backend/main.py`**

Find the `list_connections` endpoint. It constructs `ConnectionInfo` like:
```python
ConnectionInfo(
    name=name,
    host=cfg.host,
    port=cfg.port,
    user=cfg.user,
    has_password=bool(cfg.password or cfg.password_encrypted),
    needs_reauth=cfg.needs_reauth,
)
```
Add the new field:
```python
ConnectionInfo(
    name=name,
    host=cfg.host,
    port=cfg.port,
    user=cfg.user,
    has_password=bool(cfg.password or cfg.password_encrypted),
    needs_reauth=cfg.needs_reauth,
    exclude_databases=cfg.exclude_databases,
)
```

- [ ] **Step 3: Verify the backend imports cleanly**

```bash
cd backend && .venv/bin/python -c "import main; print('ok')"
```
Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: expose exclude_databases in ConnectionInfo API response"
```

---

## Task 32: Frontend — API client additions

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add `ConnectionInfo` and `TestConnectionResult` interfaces**

At the top of `client.ts`, after the existing `SavedQuery` interface, add:

```typescript
export interface ConnectionInfo {
  name: string;
  host: string;
  port: number;
  user: string;
  has_password: boolean;
  needs_reauth: boolean;
  exclude_databases: string[];
}

export interface TestConnectionResult {
  status: "ok" | "error";
  discovered_dbs: string[];
  error?: string;
}

export interface CreateConnectionResult {
  name: string;
  status: string;
  discovered_dbs: string[];
}
```

- [ ] **Step 2: Add the 5 connection API methods to the `api` object**

At the end of the `api` object (after `deleteQuery`), add:

```typescript
  // ── Connection management ──────────────────────────────────────────────────

  getConnections(): Promise<{ environments: ConnectionInfo[] }> {
    return request("/api/connections");
  },

  testConnection(body: {
    host: string; port: number; user: string; password: string;
  }): Promise<TestConnectionResult> {
    return request("/api/connections/test", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  createConnection(body: {
    name: string; host: string; port: number; user: string;
    password: string; exclude_databases: string[];
  }): Promise<CreateConnectionResult> {
    return request("/api/connections", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateConnection(
    name: string,
    patch: Partial<{ host: string; port: number; user: string; password: string; exclude_databases: string[] }>
  ): Promise<CreateConnectionResult> {
    return request(`/api/connections/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  deleteConnection(name: string): Promise<{ deleted: boolean }> {
    return request(`/api/connections/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add connection management API methods to client.ts"
```

---

## Task 33: CSS — modal and connection card styles

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add modal overlay and shell styles**

Append to the end of `frontend/src/styles.css`:

```css
/* ── Manage Connections Modal ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(3px);
}
.modal {
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: var(--r-lg);
  width: 640px; max-height: 82vh;
  display: flex; flex-direction: column;
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--line-1); flex-shrink: 0;
}
.modal-title { font-size: 14px; font-weight: 600; color: var(--tx-1); }
.modal-subtitle { font-size: 12px; color: var(--tx-3); margin-top: 2px; }
.modal-close {
  width: 28px; height: 28px; border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--tx-3); font-size: 16px; flex-shrink: 0;
}
.modal-close:hover { background: var(--bg-3); color: var(--tx-1); }
.modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.modal-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-top: 1px solid var(--line-1); flex-shrink: 0;
}
.modal-footer-left { font-size: 11px; color: var(--tx-4); }
.modal-footer-right { display: flex; gap: 8px; }

/* ── Connection cards ── */
.conn-card {
  background: var(--bg-2); border: 1px solid var(--line-1);
  border-radius: var(--r-md); padding: 14px 16px;
  display: flex; align-items: flex-start; gap: 14px;
  transition: border-color .12s;
}
.conn-card:hover { border-color: var(--line-2); }
.conn-card.reauth { border-color: rgba(224,168,74,.3); background: rgba(224,168,74,.04); }
.conn-card-icon {
  width: 36px; height: 36px; border-radius: var(--r-md);
  background: var(--bg-3); display: flex; align-items: center;
  justify-content: center; flex-shrink: 0; color: var(--tx-3);
}
.conn-card-info { flex: 1; min-width: 0; }
.conn-card-name { font-weight: 600; font-size: 13px; color: var(--tx-1); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.conn-card-host { font-family: var(--font-mono); font-size: 11px; color: var(--tx-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conn-card-badges { display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap; }
.badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 500; }
.badge-active { background: rgba(108,142,245,.15); color: var(--acc); }
.badge-ok { background: rgba(76,175,130,.15); color: #4caf82; }
.badge-warn { background: rgba(224,168,74,.15); color: var(--warn, #e0a84a); }
.badge-db { background: var(--bg-3); color: var(--tx-3); }
.conn-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.conn-action-btn {
  padding: 5px 10px; border-radius: var(--r-sm);
  font-size: 11px; font-family: var(--font-sans); font-weight: 500;
  cursor: pointer; border: 1px solid var(--line-2);
  background: var(--bg-3); color: var(--tx-2); transition: all .12s;
}
.conn-action-btn:hover { background: var(--bg-4); color: var(--tx-1); }
.conn-action-btn.danger:hover { background: rgba(224,92,106,.12); color: var(--err); border-color: rgba(224,92,106,.3); }

/* Delete confirm inline */
.conn-delete-confirm {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  font-size: 12px; color: var(--tx-2);
}

/* Re-auth row */
.reauth-row {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  background: rgba(224,168,74,.08); border: 1px solid rgba(224,168,74,.2);
  border-radius: var(--r-sm); padding: 8px 10px;
}
.reauth-row-label { font-size: 11px; color: var(--warn, #e0a84a); flex-shrink: 0; }
.reauth-input {
  flex: 1; background: var(--bg-0); border: 1px solid var(--line-2);
  border-radius: var(--r-sm); padding: 5px 8px;
  font-size: 12px; color: var(--tx-1); outline: none; font-family: var(--font-mono);
}
.reauth-input:focus { border-color: var(--warn, #e0a84a); }
.reauth-input.error { border-color: var(--err); }
.reauth-btn {
  padding: 5px 10px; border-radius: var(--r-sm); font-size: 11px;
  font-family: var(--font-sans); font-weight: 600; cursor: pointer; border: none;
  background: rgba(224,168,74,.2); color: var(--warn, #e0a84a);
  white-space: nowrap;
}
.reauth-error { font-size: 11px; color: var(--err); }

/* Add environment button */
.conn-add-btn {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  padding: 12px; border-radius: var(--r-md);
  border: 1px dashed var(--line-2); color: var(--tx-3);
  font-size: 13px; cursor: pointer; font-family: var(--font-sans);
  background: none; width: 100%; transition: all .12s;
}
.conn-add-btn:hover { background: var(--bg-2); color: var(--tx-1); border-color: var(--acc); }

/* Network error state */
.conn-load-error {
  padding: 24px; text-align: center; color: var(--tx-3); font-size: 13px;
}

/* ── Connection form (add/edit) ── */
.conn-form { display: flex; flex-direction: column; gap: 14px; }
.conn-form-grid { display: grid; grid-template-columns: 1fr 110px; gap: 12px; }
.conn-form-grid.full { grid-template-columns: 1fr; }
.conn-field { display: flex; flex-direction: column; gap: 5px; }
.conn-field-label { font-size: 11px; font-weight: 600; color: var(--tx-3); text-transform: uppercase; letter-spacing: .05em; }
.conn-field-value { font-size: 13px; color: var(--tx-1); font-weight: 500; padding: 7px 0; }
.conn-input {
  background: var(--bg-0); border: 1px solid var(--line-2);
  border-radius: var(--r-sm); padding: 7px 10px;
  font-family: var(--font-mono); font-size: 12px; color: var(--tx-1);
  outline: none; transition: border-color .12s; width: 100%;
}
.conn-input:focus { border-color: var(--acc); }
.conn-input::placeholder { color: var(--tx-4); font-family: var(--font-sans); }

/* Test result banners */
.conn-test-ok {
  display: flex; align-items: flex-start; gap: 10px;
  background: rgba(76,175,130,.1); border: 1px solid rgba(76,175,130,.25);
  border-radius: var(--r-sm); padding: 10px 12px;
  font-size: 12px; color: #4caf82;
}
.conn-test-err {
  display: flex; align-items: flex-start; gap: 10px;
  background: rgba(224,92,106,.1); border: 1px solid rgba(224,92,106,.25);
  border-radius: var(--r-sm); padding: 10px 12px;
  font-size: 12px; color: var(--err);
}

/* DB chips */
.db-chips-label { font-size: 11px; font-weight: 600; color: var(--tx-4); text-transform: uppercase; letter-spacing: .07em; margin-top: 6px; }
.db-chips-hint { font-size: 11px; color: var(--tx-4); margin-top: 4px; }
.db-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.db-chip {
  font-size: 11px; font-family: var(--font-mono);
  padding: 4px 10px; border-radius: 4px; cursor: pointer;
  border: 1px solid var(--line-2); transition: all .12s; user-select: none;
}
.db-chip.included { background: rgba(108,142,245,.12); color: var(--acc); border-color: rgba(108,142,245,.3); }
.db-chip.excluded { background: var(--bg-2); color: var(--tx-4); border-color: var(--line-1); text-decoration: line-through; opacity: .6; }

/* Save error */
.conn-save-error { font-size: 12px; color: var(--err); text-align: right; }

/* Section label */
.conn-section-label { font-size: 11px; font-weight: 600; color: var(--tx-4); text-transform: uppercase; letter-spacing: .07em; }
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles.css
git commit -m "style: modal, connection card, DB chip, re-auth CSS classes"
```

---

## Task 34: ManageConnectionsModal — list view

**Files:**
- Create: `frontend/src/components/ManageConnectionsModal.tsx`
- Modify: `frontend/src/components/TopBar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `ManageConnectionsModal.tsx` with list view**

Create `frontend/src/components/ManageConnectionsModal.tsx`:

```typescript
import { useState, useEffect } from "react";
import { api, ConnectionInfo } from "../api/client";
import { useAppStore } from "../store/useAppStore";
import { Icons } from "./Icons";

type View = "list" | "add" | "edit";

interface ManageConnectionsModalProps {
  onClose: () => void;
}

export function ManageConnectionsModal({ onClose }: ManageConnectionsModalProps) {
  const { activeEnv, reloadConfig } = useAppStore();
  const [view, setView] = useState<View>("list");
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ConnectionInfo | null>(null);

  // Re-auth state: { [envName]: { value, error, submitting } }
  const [reauth, setReauth] = useState<Record<string, { value: string; error: string | null; submitting: boolean }>>({});

  // Delete confirm state: envName that is pending confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function fetchConnections() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getConnections();
      setConnections(res.environments);
    } catch (e: unknown) {
      setLoadError("Could not load connections. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchConnections(); }, []);

  async function handleUnlock(envName: string) {
    const r = reauth[envName];
    if (!r?.value.trim()) return;
    setReauth(prev => ({ ...prev, [envName]: { ...prev[envName], submitting: true, error: null } }));
    try {
      await api.updateConnection(envName, { password: r.value });
      await reloadConfig();
      await fetchConnections();
      setReauth(prev => { const next = { ...prev }; delete next[envName]; return next; });
    } catch {
      setReauth(prev => ({ ...prev, [envName]: { ...prev[envName], submitting: false, error: "Incorrect password" } }));
    }
  }

  async function handleDelete(envName: string) {
    try {
      await api.deleteConnection(envName);
      await reloadConfig();
      setDeleteConfirm(null);
      await fetchConnections();
    } catch (e: unknown) {
      // Silently re-fetch; active-env guard is visual so this shouldn't happen
      await fetchConnections();
    }
  }

  function startEdit(conn: ConnectionInfo) {
    setEditTarget(conn);
    setView("edit");
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Manage Connections</div>
            <div className="modal-subtitle">
              {view === "list" && `${connections.length} environment${connections.length !== 1 ? "s" : ""} configured`}
              {view === "add" && "Add environment"}
              {view === "edit" && `Edit — ${editTarget?.name}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {view === "list" && (
            <>
              {loading && (
                <div style={{ color: "var(--tx-3)", fontSize: 13, padding: "8px 0" }}>Loading...</div>
              )}
              {loadError && (
                <div className="conn-load-error">
                  {loadError}
                  <br />
                  <button className="btn-ghost" style={{ marginTop: 10 }} onClick={fetchConnections}>Retry</button>
                </div>
              )}
              {!loading && !loadError && connections.map(conn => (
                <div key={conn.name} className={`conn-card${conn.needs_reauth ? " reauth" : ""}`}>
                  <div className="conn-card-icon">
                    <Icons.db size={16} />
                  </div>
                  <div className="conn-card-info">
                    <div className="conn-card-name">
                      {conn.name}
                      {conn.name === activeEnv && <span className="badge badge-active">active</span>}
                      {conn.needs_reauth && <span className="badge badge-warn">⚠ re-auth needed</span>}
                    </div>
                    <div className="conn-card-host">{conn.host}:{conn.port} · {conn.user}</div>
                    <div className="conn-card-badges">
                      {!conn.needs_reauth && conn.name !== activeEnv && <span className="badge badge-db">saved</span>}
                    </div>

                    {/* Re-auth inline */}
                    {conn.needs_reauth && (
                      <div className="reauth-row">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="var(--warn,#e0a84a)" strokeWidth="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="var(--warn,#e0a84a)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        <span className="reauth-row-label">Re-enter password:</span>
                        <input
                          className={`reauth-input${reauth[conn.name]?.error ? " error" : ""}`}
                          type="password"
                          placeholder="password"
                          value={reauth[conn.name]?.value ?? ""}
                          onChange={e => setReauth(prev => ({ ...prev, [conn.name]: { value: e.target.value, error: null, submitting: false } }))}
                          onKeyDown={e => { if (e.key === "Enter") handleUnlock(conn.name); }}
                        />
                        <button className="reauth-btn" onClick={() => handleUnlock(conn.name)} disabled={reauth[conn.name]?.submitting}>
                          {reauth[conn.name]?.submitting ? "..." : "Unlock"}
                        </button>
                        {reauth[conn.name]?.error && <span className="reauth-error">{reauth[conn.name].error}</span>}
                      </div>
                    )}

                    {/* Delete confirm */}
                    {deleteConfirm === conn.name && (
                      <div className="conn-delete-confirm">
                        Delete {conn.name}? This cannot be undone.
                        <button className="conn-action-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                        <button className="conn-action-btn danger" onClick={() => handleDelete(conn.name)}>Delete</button>
                      </div>
                    )}
                  </div>

                  <div className="conn-card-actions">
                    <button className="conn-action-btn" onClick={() => startEdit(conn)}>Edit</button>
                    {conn.name !== activeEnv && deleteConfirm !== conn.name && (
                      <button className="conn-action-btn danger" onClick={() => setDeleteConfirm(conn.name)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
              {!loading && !loadError && (
                <button className="conn-add-btn" onClick={() => setView("add")}>
                  <Icons.plus size={14} /> Add environment
                </button>
              )}
            </>
          )}

          {(view === "add" || view === "edit") && (
            <ConnectionForm
              mode={view}
              initial={editTarget}
              onSaved={async () => {
                await reloadConfig();
                await fetchConnections();
                setView("list");
              }}
              onCancel={() => setView("list")}
            />
          )}
        </div>

        {view === "list" && (
          <div className="modal-footer">
            <div className="modal-footer-left">Passwords encrypted with machine key</div>
            <div className="modal-footer-right">
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConnectionForm sub-component ──────────────────────────────────────────────

interface ConnectionFormProps {
  mode: "add" | "edit";
  initial: ConnectionInfo | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

function ConnectionForm({ mode, initial, onSaved, onCancel }: ConnectionFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(String(initial?.port ?? 5432));
  const [user, setUser] = useState(initial?.user ?? "");
  const [password, setPassword] = useState("");

  // Discovered DBs from test (null = not tested yet)
  const [discoveredDbs, setDiscoveredDbs] = useState<string[] | null>(null);
  // excludedDbs set: starts from initial.exclude_databases
  const [excludedDbs, setExcludedDbs] = useState<Set<string>>(
    new Set(initial?.exclude_databases ?? [])
  );
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canSave = mode === "add"
    ? name.trim() && host.trim() && user.trim() && password.trim()
    : host.trim() && user.trim(); // name is read-only on edit

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setDiscoveredDbs(null);
    try {
      const res = await api.testConnection({
        host: host.trim(),
        port: Number(port) || 5432,
        user: user.trim(),
        password,
      });
      if (res.status === "ok") {
        setDiscoveredDbs(res.discovered_dbs);
        // On edit: pre-mark already-excluded DBs
        setExcludedDbs(new Set(initial?.exclude_databases ?? []));
        setTestResult({ ok: true, message: `Connected — ${res.discovered_dbs.length} databases discovered` });
      } else {
        setTestResult({ ok: false, message: res.error ?? "Connection failed" });
      }
    } catch (e: unknown) {
      setTestResult({ ok: false, message: "Network error — is the backend running?" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const excluded = Array.from(excludedDbs);
    try {
      if (mode === "add") {
        await api.createConnection({
          name: name.trim(),
          host: host.trim(),
          port: Number(port) || 5432,
          user: user.trim(),
          password,
          exclude_databases: excluded,
        });
      } else {
        const patch: Record<string, unknown> = {
          host: host.trim(),
          port: Number(port) || 5432,
          user: user.trim(),
          exclude_databases: excluded,
        };
        if (password.trim()) patch.password = password;
        await api.updateConnection(initial!.name, patch as Parameters<typeof api.updateConnection>[1]);
      }
      await onSaved();
    } catch (e: unknown) {
      const msg = (e && typeof e === "object" && "detail" in e) ? String((e as { detail: unknown }).detail) : "Save failed";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  function toggleChip(db: string) {
    setExcludedDbs(prev => {
      const next = new Set(prev);
      if (next.has(db)) { next.delete(db); } else { next.add(db); }
      return next;
    });
  }

  return (
    <>
      <div className="conn-form">
        <div className="conn-section-label">Connection details</div>

        {mode === "add" ? (
          <div className="conn-form-grid full">
            <div className="conn-field">
              <div className="conn-field-label">Display name</div>
              <input className="conn-input" placeholder="e.g. production" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="conn-form-grid full">
            <div className="conn-field">
              <div className="conn-field-label">Display name</div>
              <div className="conn-field-value">{initial?.name}</div>
            </div>
          </div>
        )}

        <div className="conn-form-grid">
          <div className="conn-field">
            <div className="conn-field-label">Host</div>
            <input className="conn-input" placeholder="hostname or IP" value={host} onChange={e => setHost(e.target.value)} />
          </div>
          <div className="conn-field">
            <div className="conn-field-label">Port</div>
            <input className="conn-input" placeholder="5432" value={port} onChange={e => setPort(e.target.value)} />
          </div>
        </div>

        <div className="conn-form-grid">
          <div className="conn-field">
            <div className="conn-field-label">Username</div>
            <input className="conn-input" placeholder="postgres" value={user} onChange={e => setUser(e.target.value)} />
          </div>
          <div className="conn-field">
            <div className="conn-field-label">Password</div>
            <input
              className="conn-input"
              type="password"
              placeholder={mode === "edit" ? "Leave blank to keep current" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={testResult.ok ? "conn-test-ok" : "conn-test-err"}>
            {testResult.ok
              ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#4caf82" strokeWidth="1.4"/><path d="M5 8l2.5 2.5L11 5.5" stroke="#4caf82" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--err)" strokeWidth="1.4"/><path d="M6 6l4 4M10 6l-4 4" stroke="var(--err)" strokeWidth="1.4" strokeLinecap="round"/></svg>
            }
            {testResult.message}
          </div>
        )}

        {/* DB chips — shown after successful test */}
        {discoveredDbs !== null && testResult?.ok && (
          <>
            <div className="db-chips-label">Databases</div>
            <div className="db-chips-hint">Click a database to exclude it from the sidebar and autocomplete.</div>
            <div className="db-chips">
              {discoveredDbs.map(db => (
                <div
                  key={db}
                  className={`db-chip ${excludedDbs.has(db) ? "excluded" : "included"}`}
                  onClick={() => toggleChip(db)}
                >
                  {db}
                </div>
              ))}
            </div>
          </>
        )}

        {saveError && <div className="conn-save-error">{saveError}</div>}
      </div>

      <div className="modal-footer">
        <button className="btn-test conn-action-btn" onClick={handleTest} disabled={testing}>
          {testing ? "Testing..." : "Test connection"}
        </button>
        <div className="modal-footer-right">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{ opacity: (!canSave || saving) ? .5 : 1, cursor: (!canSave || saving) ? "default" : "pointer" }}
          >
            {saving ? "Saving..." : mode === "add" ? "Save" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add gear icon to `Icons.tsx`**

The existing Icons file doesn't have a settings/gear icon. Append before the closing `};`:

```typescript
  settings: ({ size = 14 }: P) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
```

- [ ] **Step 3: Add gear button to `TopBar.tsx`**

Add `onManageConnections: () => void` to the `TopBarProps` interface:
```typescript
interface TopBarProps {
  // ... existing props ...
  onManageConnections: () => void;
}
```

Destructure it in the function signature:
```typescript
export function TopBar({
  // ... existing params ...
  onManageConnections,
}: TopBarProps) {
```

In the `topbar-right` div, add the gear button between the theme toggle and the Refresh button:
```tsx
<button
  className="icon-btn"
  onClick={onManageConnections}
  title="Manage connections"
>
  <Icons.settings size={14} />
</button>
```

- [ ] **Step 4: Wire modal in `App.tsx`**

Add `useState` import (already imported) and add state + modal render:

```typescript
// Add near top of App component, after existing state:
const [manageConnectionsOpen, setManageConnectionsOpen] = useState(false);
```

Add import at top of file:
```typescript
import { ManageConnectionsModal } from "./components/ManageConnectionsModal";
```

Pass prop to TopBar:
```tsx
<TopBar
  {/* ... existing props ... */}
  onManageConnections={() => setManageConnectionsOpen(true)}
/>
```

Render modal after `<StatusBar />`:
```tsx
{manageConnectionsOpen && (
  <ManageConnectionsModal onClose={() => setManageConnectionsOpen(false)} />
)}
```

- [ ] **Step 5: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ManageConnectionsModal.tsx \
        frontend/src/components/Icons.tsx \
        frontend/src/components/TopBar.tsx \
        frontend/src/App.tsx
git commit -m "feat: ManageConnectionsModal — list, add, edit, re-auth, exclude DBs"
```

---

## Task 35: Push branch and open PR

- [ ] **Step 1: Push branch**

```bash
git push origin feature/ui-redesign-auto-discovery
```

- [ ] **Step 2: Verify the app works end-to-end**

```bash
./start.sh
```

Open http://localhost:5173. Click the ⚙ gear icon in the TopBar. Verify:
- List view loads existing connections from `connections.yaml`
- Edit a connection → form pre-fills correctly, save updates the file
- Add a connection → test connection → DB chips appear → save writes to YAML
- Delete a non-active connection → confirm inline → disappears from list
- Active connection has no Delete button

```bash
./stop.sh
```

---

## Self-Review

**Spec coverage:**
- §1 Access point → Task 34 Step 3 (gear button in TopBar) ✓
- §2.1 List view → Task 34 Step 1 (list render, badges, edit/delete) ✓
- §2.1 Re-auth → Task 34 Step 1 (`reauth-row` in list cards) ✓
- §2.2 Add form → Task 34 Step 1 (`ConnectionForm` with mode="add") ✓
- §2.3 Exclude DB chips → Task 34 Step 1 (`discoveredDbs` chips section) ✓
- §2.4 Edit form → Task 34 Step 1 (`ConnectionForm` with mode="edit", read-only name) ✓
- §3 API client → Task 32 ✓
- §4 Backend `exclude_databases` → Task 31 ✓
- §5 Styles → Task 33 ✓
- §6 Error handling → all error states handled inline in `ConnectionForm` and list cards ✓

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:** `ConnectionInfo.exclude_databases: string[]` defined in Task 32 Step 1, used in Task 34 Step 1 (`initial?.exclude_databases`). `api.updateConnection` patch type is `Partial<{host, port, user, password, exclude_databases}>` — matches usage in `ConnectionForm.handleSave`. ✓
