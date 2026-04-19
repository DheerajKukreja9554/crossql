import { useState, useMemo } from "react";
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

  const query = search.toLowerCase().trim();

  const filteredSchema = useMemo(() => {
    if (!query) return schema;

    const result: SchemaCache = {};
    for (const [db, tables] of Object.entries(schema)) {
      const filteredTables: Record<string, string[]> = {};
      for (const [table, columns] of Object.entries(tables)) {
        const tableMatches = table.toLowerCase().includes(query);
        const matchingCols = columns.filter((c) =>
          c.toLowerCase().includes(query),
        );
        if (tableMatches || matchingCols.length > 0) {
          filteredTables[table] = tableMatches ? columns : matchingCols;
        }
      }
      if (Object.keys(filteredTables).length > 0) {
        result[db] = filteredTables;
      }
    }
    return result;
  }, [schema, query]);

  const totalTables = useMemo(
    () =>
      Object.values(schema).reduce(
        (sum, tables) => sum + Object.keys(tables).length,
        0,
      ),
    [schema],
  );

  const toggleDb = (db: string) =>
    setExpandedDbs((prev) => ({ ...prev, [db]: !prev[db] }));

  const toggleTable = (key: string) =>
    setExpandedTables((prev) => ({ ...prev, [key]: !prev[key] }));

  if (collapsed) {
    return (
      <div className="sidebar" style={{ width: "auto", minWidth: 0 }}>
        <div className="sb-head">
          <div className="sb-head-row">
            <div className="sb-head-actions">
              <button
                className="sb-icon-btn"
                title="Expand sidebar"
                onClick={() => setCollapsed(false)}
              >
                <Icons.sidebar />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sb-head">
        <div className="sb-head-row">
          <span className="sb-title">Databases</span>
          <div className="sb-head-actions">
            <button
              className="sb-icon-btn"
              title="Refresh schema"
              onClick={onReloadConfig}
            >
              <Icons.refresh />
            </button>
            <button
              className="sb-icon-btn"
              title="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <Icons.sidebar />
            </button>
          </div>
        </div>
        <input
          className="sb-search"
          type="text"
          placeholder="Filter tables & columns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sb-body">
        {activeHost && (
          <div className="sb-server">
            <div className="sb-server-head">
              <div className="sb-server-main">
                <span className="sb-server-name">{activeEnv ?? "Server"}</span>
                <span className="sb-server-host mono">{activeHost}</span>
              </div>
              <span className="sb-server-count">{totalTables} tables</span>
            </div>

            <div className="sb-server-body">
              {Object.entries(filteredSchema).map(([db, tables]) => {
                const dbExpanded = expandedDbs[db] ?? !!query;
                const status = dbStatus[db];

                return (
                  <div className="sb-db" key={db}>
                    <div className="sb-db-head-wrap">
                      <button
                        className="sb-db-head"
                        onClick={() => toggleDb(db)}
                      >
                        <span
                          className={`sb-chev ${dbExpanded ? "sb-chev--open" : ""}`}
                        >
                          {dbExpanded ? (
                            <Icons.chev size={10} />
                          ) : (
                            <Icons.chevRight size={10} />
                          )}
                        </span>
                        <Icons.db size={13} />
                        <span className="sb-db-name">{db}</span>
                        {status && (
                          <span
                            className={`db-badge__dot db-badge__dot--${status}`}
                            title={status}
                          />
                        )}
                      </button>
                    </div>

                    {dbExpanded && (
                      <div className="sb-tables">
                        {Object.entries(tables).map(([table, columns]) => {
                          const tableKey = `${db}.${table}`;
                          const tableExpanded =
                            expandedTables[tableKey] ?? !!query;

                          return (
                            <div className="sb-table" key={tableKey}>
                              <div className="sb-table-head">
                                <button
                                  className="sb-table-name"
                                  onClick={() => toggleTable(tableKey)}
                                >
                                  <span
                                    className={`sb-chev ${tableExpanded ? "sb-chev--open" : ""}`}
                                  >
                                    {tableExpanded ? (
                                      <Icons.chev size={10} />
                                    ) : (
                                      <Icons.chevRight size={10} />
                                    )}
                                  </span>
                                  <Icons.table size={12} />
                                  <span className="mono">{table}</span>
                                </button>
                                <button
                                  className="sb-insert sb-icon-btn"
                                  title={`Insert ${db}.${table}`}
                                  onClick={() => onInsertRef(`${db}.${table}`)}
                                >
                                  <Icons.plus size={10} />
                                </button>
                              </div>

                              {tableExpanded && (
                                <div className="sb-cols">
                                  {columns.map((col) => (
                                    <div className="sb-col" key={col}>
                                      <Icons.column size={10} />
                                      <span className="sb-col-name mono">
                                        {col}
                                      </span>
                                    </div>
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
        )}

        {!activeHost && (
          <div className="sb-add-server">
            No environment selected. Choose one above to browse databases.
          </div>
        )}
      </div>
    </div>
  );
}
