import { useState } from "react";
import { Icons } from "./Icons";
import type { SavedQuery } from "../api/client";
import type { HistoryEntry } from "../store/useAppStore";

interface SavedQueriesPanelProps {
  savedQueries: SavedQuery[];
  history: HistoryEntry[];
  onOpen: (sql: string, name?: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SavedQueriesPanel({
  savedQueries,
  history,
  onOpen,
  onDelete,
  onRename,
}: SavedQueriesPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const recentHistory = history.slice(0, 10);

  function startRename(q: SavedQuery) {
    setEditingId(q.id);
    setEditName(q.name);
  }

  function commitRename(id: string) {
    const trimmed = editName.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  }

  return (
    <div className="sq-panel">
      {/* Recent history section */}
      <div className="sq-section">
        <button
          className="sq-section-head"
          onClick={() => setHistoryOpen(o => !o)}
        >
          <span style={{ color: "var(--tx-4)", display: "inline-flex" }}>
            {historyOpen ? <Icons.chev size={10} /> : <Icons.chevRight size={10} />}
          </span>
          <span className="sq-section-title">Recent</span>
          <span className="sq-count">{recentHistory.length}</span>
        </button>

        {historyOpen && (
          <div className="sq-list">
            {recentHistory.length === 0 ? (
              <div className="sq-empty">No history yet</div>
            ) : (
              recentHistory.map((h, i) => (
                <button
                  key={i}
                  className="sq-item"
                  title={h.sql}
                  onClick={() => onOpen(h.sql)}
                >
                  <span className={`dot ${h.success ? "ok" : "err"}`} style={{ width: 5, height: 5, flexShrink: 0 }} />
                  <span className="sq-item-sql mono">{h.sql.slice(0, 60).replace(/\s+/g, " ")}</span>
                  <span className="sq-item-meta">{relativeTime(h.timestamp)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Saved queries */}
      <div className="sq-section">
        <div className="sq-section-head" style={{ cursor: "default" }}>
          <span className="sq-section-title">Saved</span>
          <span className="sq-count">{savedQueries.length}</span>
        </div>

        <div className="sq-list">
          {savedQueries.length === 0 ? (
            <div className="sq-empty">
              No saved queries yet.<br />
              Run a query and click Save.
            </div>
          ) : (
            savedQueries.map(q => (
              <div key={q.id} className="sq-item-row">
                {editingId === q.id ? (
                  <input
                    className="sq-rename-input"
                    value={editName}
                    autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => commitRename(q.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename(q.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    className="sq-item"
                    title={q.sql}
                    onClick={() => onOpen(q.sql, q.name)}
                    onDoubleClick={() => startRename(q)}
                  >
                    <span style={{ color: "var(--sx-table)", display: "inline-flex", flexShrink: 0 }}>
                      <Icons.bookmark size={11} />
                    </span>
                    <span className="sq-item-name">{q.name}</span>
                    <span className="sq-item-meta">{relativeTime(q.updated_at)}</span>
                  </button>
                )}
                <button
                  className="sq-delete"
                  title="Delete"
                  onClick={() => onDelete(q.id)}
                >
                  <Icons.close size={9} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
