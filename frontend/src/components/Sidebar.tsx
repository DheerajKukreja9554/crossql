import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Icons } from "./Icons";
import type { SchemaCache, DbStatus } from "../api/client";

interface SidebarProps {
  schema: SchemaCache;
  dbStatus: DbStatus;
  activeHost: string | null;
  activeEnv: string | null;
  onInsertRef: (ref: string) => void;
  onReloadConfig: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 272;

export function Sidebar({
  schema,
  dbStatus,
  activeHost,
  activeEnv,
  onInsertRef,
  onReloadConfig,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({});
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const query = search.toLowerCase().trim();

  // Drag-to-resize
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const filteredSchema = useMemo(() => {
    if (!query) return schema;
    const result: SchemaCache = {};
    for (const [db, tables] of Object.entries(schema)) {
      const filteredTables: Record<string, string[]> = {};
      for (const [table, columns] of Object.entries(tables)) {
        const tableMatches = table.toLowerCase().includes(query);
        const matchingCols = columns.filter((c) => c.toLowerCase().includes(query));
        if (tableMatches || matchingCols.length > 0) {
          filteredTables[table] = tableMatches ? columns : matchingCols;
        }
      }
      if (
        Object.keys(filteredTables).length > 0 ||
        db.toLowerCase().includes(query)
      ) {
        result[db] = filteredTables;
      }
    }
    return result;
  }, [schema, query]);

  const dbCount = Object.keys(schema).length;

  const toggleDb = (db: string) =>
    setExpandedDbs((prev) => ({ ...prev, [db]: !prev[db] }));
  const toggleTable = (key: string) =>
    setExpandedTables((prev) => ({ ...prev, [key]: !prev[key] }));

  if (collapsed) {
    return (
      <div className="sidebar-collapsed">
        <button
          className="sb-icon-btn"
          title="Expand sidebar"
          onClick={() => setCollapsed(false)}
        >
          <Icons.sidebar size={14} />
        </button>
        <div style={{ width: 24, height: 1, background: "var(--line-1)", margin: "4px 0" }} />
        {Object.keys(schema)
          .slice(0, 8)
          .map((db) => (
            <button key={db} className="sb-icon-btn" title={db}>
              <Icons.db size={13} />
            </button>
          ))}
        {dbCount > 8 && (
          <span style={{ fontSize: 10, color: "var(--tx-4)" }}>+{dbCount - 8}</span>
        )}
      </div>
    );
  }

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width }}>
      {/* Header */}
      <div className="sb-head">
        <div className="sb-head-row">
          <span className="sb-title">Databases</span>
          <div className="sb-head-actions">
            <button className="sb-icon-btn" title="Refresh" onClick={onReloadConfig}>
              <Icons.refresh size={12} />
            </button>
            <button className="sb-icon-btn" title="Collapse" onClick={() => setCollapsed(true)}>
              <Icons.sidebar size={14} />
            </button>
          </div>
        </div>
        <div className="sb-search">
          <span style={{ color: "var(--tx-4)", display: "flex" }}>
            <Icons.search size={12} />
          </span>
          <input
            type="text"
            placeholder="Filter tables & columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="sb-icon-btn" style={{ width: 18, height: 18 }} onClick={() => setSearch("")}>
              <Icons.close size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Tree body */}
      <div className="sb-body">
        {activeHost ? (
          <div className="sb-server">
            {/* Server header */}
            <button className="sb-server-head">
              <span className="dot ok" />
              <div className="sb-server-main">
                <div className="sb-server-name">{activeEnv ?? "Server"}</div>
                <div className="sb-server-host mono">
                  {activeHost.length > 35
                    ? activeHost.slice(0, 32) + "..."
                    : activeHost}
                </div>
              </div>
              <span className="sb-server-count">{dbCount}</span>
            </button>

            {/* Database list */}
            <div className="sb-server-body">
              {Object.entries(filteredSchema).map(([db, tables]) => {
                const isOpen = expandedDbs[db] ?? !!query;
                const status = dbStatus[db];
                const tableCount = Object.keys(tables).length;

                return (
                  <div className="sb-db" key={db}>
                    {/* DB row */}
                    <div className="sb-db-head-wrap">
                      <button className="sb-db-head" onClick={() => toggleDb(db)}>
                        <span style={{ width: 14, display: "inline-flex", flexShrink: 0, color: "var(--tx-4)" }}>
                          {isOpen ? <Icons.chev size={10} /> : <Icons.chevRight size={10} />}
                        </span>
                        <span style={{ color: "var(--sx-db)", display: "inline-flex", flexShrink: 0 }}>
                          <Icons.db size={12} />
                        </span>
                        <span className="sb-db-name">{db}</span>
                        {status && (
                          <span
                            className={`dot ${status === "ok" ? "ok" : "err"}`}
                            style={{ width: 5, height: 5 }}
                          />
                        )}
                        <span style={{ fontSize: 10, color: "var(--tx-4)", marginLeft: "auto", flexShrink: 0 }}>
                          {tableCount}
                        </span>
                      </button>
                    </div>

                    {/* Tables under this DB */}
                    {isOpen && (
                      <div className="sb-tables">
                        {Object.entries(tables).map(([table, columns]) => {
                          const tKey = `${db}.${table}`;
                          const tOpen = expandedTables[tKey] ?? !!query;

                          return (
                            <div key={tKey}>
                              {/* Table row */}
                              <div className="sb-table">
                                <button className="sb-table-head" onClick={() => toggleTable(tKey)}>
                                  <span style={{ width: 14, display: "inline-flex", flexShrink: 0, color: "var(--tx-4)" }}>
                                    {tOpen ? <Icons.chev size={10} /> : <Icons.chevRight size={10} />}
                                  </span>
                                  <span style={{ color: "var(--sx-table)", display: "inline-flex", flexShrink: 0 }}>
                                    <Icons.table size={11} />
                                  </span>
                                  <span className="sb-table-name">{table}</span>
                                  <span className="sb-table-rows">{columns.length} cols</span>
                                </button>
                                <button
                                  className="sb-insert"
                                  title={`Insert ${db}.${table}`}
                                  onClick={() => onInsertRef(`${db}.${table}`)}
                                >
                                  <Icons.plus size={10} />
                                </button>
                              </div>

                              {/* Columns under this table */}
                              {tOpen && (
                                <div className="sb-cols">
                                  {columns.map((col) => (
                                    <button
                                      className="sb-col"
                                      key={col}
                                      onClick={() => onInsertRef(`${col}`)}
                                      title={`${db}.${table}.${col}`}
                                    >
                                      <span style={{ color: "var(--tx-4)", display: "inline-flex", flexShrink: 0 }}>
                                        <Icons.column size={10} />
                                      </span>
                                      <span className="sb-col-name">{col}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 12px", fontSize: "var(--tx-sm)", color: "var(--tx-3)", textAlign: "center" }}>
            No environment selected.
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="sb-resize-handle"
        onMouseDown={onMouseDown}
      />
    </div>
  );
}
