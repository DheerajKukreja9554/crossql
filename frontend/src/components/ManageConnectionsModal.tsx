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

  // Delete error feedback
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    setDeleteError(null);
    try {
      await api.deleteConnection(envName);
      await reloadConfig();
      setDeleteConfirm(null);
      await fetchConnections();
    } catch (e: unknown) {
      setDeleteError(`Failed to delete ${envName}. Please try again.`);
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
                        {reauth[conn.name]?.error && <span className="reauth-error">{reauth[conn.name]?.error}</span>}
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
              {deleteError && (
                <div style={{ fontSize: 12, color: "var(--err)", padding: "4px 0" }}>{deleteError}</div>
              )}
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
        if (!initial) return;
        const patch: Record<string, unknown> = {
          host: host.trim(),
          port: Number(port) || 5432,
          user: user.trim(),
          exclude_databases: excluded,
        };
        if (password.trim()) patch.password = password;
        await api.updateConnection(initial.name, patch as Parameters<typeof api.updateConnection>[1]);
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
