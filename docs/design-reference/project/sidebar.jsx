// sidebar.jsx — Servers → Databases tree with per-DB caps + add server button
const { useState: useStateS, useMemo: useMemoS } = React;

function fmtRows(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}
function fmtCap(n) {
  if (n === 0) return '∞';
  if (n >= 1_000_000) return `${n/1_000_000}M`;
  return `${n/1000}K`;
}

function Sidebar({ env, onInsertRef, collapsed, setCollapsed, onConnectServer, dbCaps, onEditCap }) {
  const [expanded, setExpanded] = useStateS({ account_management: true, on_boarding: true, ledger: true, cards: false, rewards: false });
  const [expandedTable, setExpandedTable] = useStateS({});
  const [serverOpen, setServerOpen] = useStateS(true);
  const [q, setQ] = useStateS('');

  const filtered = useMemoS(() => {
    if (!q.trim()) return DATABASES;
    const needle = q.toLowerCase();
    return DATABASES.map(db => {
      const tables = db.tables.filter(t =>
        t.name.toLowerCase().includes(needle) ||
        t.columns.some(c => c.name.toLowerCase().includes(needle))
      );
      if (tables.length === 0 && !db.name.toLowerCase().includes(needle)) return null;
      return { ...db, tables };
    }).filter(Boolean);
  }, [q]);

  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button className="sb-icon-btn" onClick={() => setCollapsed(false)} title="Expand">{I.sidebar(14)}</button>
        <div className="sb-col-divider" />
        {DATABASES.map(db => <button key={db.name} className="sb-icon-btn" title={db.name}>{I.db(14)}</button>)}
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sb-head">
        <div className="sb-head-row">
          <div className="sb-title">Servers</div>
          <div className="sb-head-actions">
            <button className="sb-icon-btn" onClick={onConnectServer} title="Connect server">{I.plus(12)}</button>
            <button className="sb-icon-btn" title="Re-scan all">{I.bolt(12)}</button>
            <button className="sb-icon-btn" onClick={() => setCollapsed(true)} title="Collapse">{I.sidebar(14)}</button>
          </div>
        </div>
        <div className="sb-search">
          <span style={{ color: 'var(--tx-4)' }}>{I.search(12)}</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter tables, columns…" />
          {q && <button onClick={() => setQ('')} className="sb-icon-btn sm">{I.close(10)}</button>}
        </div>
      </div>

      <div className="sb-body">
        {/* SERVER NODE */}
        <div className="sb-server">
          <button className="sb-server-head" onClick={() => setServerOpen(!serverOpen)}>
            <span style={{ color: 'var(--tx-4)', width: 12 }}>{I.chev(serverOpen ? 'down' : 'right')}</span>
            <span className="dot ok" />
            <div className="sb-server-main">
              <div className="sb-server-name">vegapay-sandbox</div>
              <div className="sb-server-host mono">vegapay-sandbox-…azure.com · {env.user}</div>
            </div>
            <span className="sb-server-count">{DATABASES.length}</span>
          </button>

          {serverOpen && (
            <div className="sb-server-body">
              {filtered.map(db => {
                const isOpen = expanded[db.name];
                const cap = dbCaps[db.name] ?? 50000;
                const capWarn = cap === 0;
                const capRaised = cap > 50000;
                return (
                  <div key={db.name} className="sb-db">
                    <div className="sb-db-head-wrap">
                      <button className="sb-db-head" onClick={() => setExpanded(x => ({ ...x, [db.name]: !x[db.name] }))}>
                        <span style={{ color: 'var(--tx-4)', width: 10 }}>{I.chev(isOpen ? 'down' : 'right')}</span>
                        <span style={{ color: 'var(--sx-db)' }}>{I.db(12)}</span>
                        <span className="sb-db-name">{db.name}</span>
                      </button>
                      <button
                        className={`sb-cap ${capWarn ? 'sb-cap-warn' : ''} ${capRaised ? 'sb-cap-up' : ''}`}
                        onClick={() => onEditCap(db.name)}
                        title={`Row cap: ${capWarn ? 'unlimited' : cap.toLocaleString() + ' rows'} per sub-query`}
                      >
                        <span>{fmtCap(cap)}</span>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="sb-tables">
                        <div className="sb-db-desc">{db.desc}</div>
                        {db.tables.map(t => {
                          const tKey = `${db.name}.${t.name}`;
                          const tOpen = expandedTable[tKey];
                          return (
                            <div key={t.name}>
                              <div className="sb-table">
                                <button className="sb-table-head" onClick={() => setExpandedTable(x => ({ ...x, [tKey]: !x[tKey] }))}>
                                  <span style={{ color: 'var(--tx-4)', width: 10, display: 'inline-flex' }}>{I.chev(tOpen ? 'down' : 'right')}</span>
                                  <span style={{ color: 'var(--sx-table)' }}>{I.table(12)}</span>
                                  <span className="sb-table-name">{t.name}</span>
                                  <span className="sb-table-rows">{fmtRows(t.rows)}</span>
                                </button>
                                <button className="sb-insert" title={`Insert ${db.name}.${t.name}`} onClick={() => onInsertRef(`${db.name}.${t.name}`)}>{I.plus(10)}</button>
                              </div>
                              {tOpen && (
                                <div className="sb-cols">
                                  {t.columns.map(c => (
                                    <button key={c.name} className="sb-col" onClick={() => onInsertRef(`${db.name}.${t.name}.${c.name}`)}>
                                      <span style={{ color: c.pk ? 'var(--warn)' : 'var(--tx-4)', width: 12, display: 'inline-flex' }}>{c.pk ? I.key(11) : I.column(11)}</span>
                                      <span className="sb-col-name">{c.name}</span>
                                      <span className="sb-col-type mono">{c.type}</span>
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
          )}
        </div>

        <button className="sb-add-server" onClick={onConnectServer}>
          {I.plus(12)} <span>Connect another server</span>
        </button>
      </div>

      <style>{`
        .sidebar { width: 272px; flex-shrink: 0; display: flex; flex-direction: column; background: var(--bg-1); border-right: 1px solid var(--line-1); overflow: hidden; }
        .sidebar-collapsed { width: 42px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: var(--bg-1); border-right: 1px solid var(--line-1); padding: 6px 0; gap: 4px; }
        .sb-col-divider { width: 24px; height: 1px; background: var(--line-1); margin: 4px 0; }
        .sb-head { padding: 8px 10px 6px; border-bottom: 1px solid var(--line-1); }
        .sb-head-row { display: flex; align-items: center; margin-bottom: 6px; }
        .sb-title { font-size: var(--tx-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--tx-3); font-weight: 600; flex: 1; }
        .sb-head-actions { display: flex; gap: 2px; }
        .sb-icon-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: var(--r-sm); color: var(--tx-3); }
        .sb-icon-btn.sm { width: 18px; height: 18px; }
        .sb-icon-btn:hover { background: var(--bg-3); color: var(--tx-1); }

        .sb-search { display: flex; align-items: center; gap: 6px; background: var(--bg-input); border: 1px solid var(--line-2); border-radius: var(--r-md); padding: 4px 6px 4px 8px; }
        .sb-search:focus-within { border-color: var(--acc-line, var(--acc)); }
        .sb-search input { flex: 1; background: none; border: none; outline: none; font-size: var(--tx-sm); color: var(--tx-1); }
        .sb-search input::placeholder { color: var(--tx-4); }

        .sb-body { flex: 1; overflow-y: auto; padding: 6px 0 40px; }

        .sb-server { margin-bottom: 4px; }
        .sb-server-head { display: flex; align-items: center; gap: 7px; width: 100%; padding: 6px 10px; text-align: left; border-bottom: 1px solid var(--line-1); }
        .sb-server-head:hover { background: var(--bg-2); }
        .sb-server-main { flex: 1; min-width: 0; }
        .sb-server-name { font-size: var(--tx-sm); font-weight: 600; color: var(--tx-1); }
        .sb-server-host { font-size: 10.5px; color: var(--tx-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-server-count { font-size: 10.5px; color: var(--tx-3); background: var(--bg-3); padding: 1px 6px; border-radius: 3px; }
        .sb-server-body { padding: 4px 0; }

        .sb-db { margin-bottom: 1px; }
        .sb-db-head-wrap { display: flex; align-items: center; }
        .sb-db-head-wrap:hover { background: var(--bg-2); }
        .sb-db-head { display: flex; align-items: center; gap: 6px; flex: 1; padding: 4px 4px 4px 10px; color: var(--tx-2); font-size: var(--tx-sm); text-align: left; min-width: 0; }
        .sb-db-name { flex: 1; font-weight: 500; color: var(--tx-1); font-family: var(--font-mono); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb-cap {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 34px; height: 18px; padding: 0 6px;
          margin-right: 8px; border-radius: 999px;
          font-family: var(--font-mono); font-size: 10px;
          background: var(--bg-3); color: var(--tx-3);
          border: 1px solid transparent;
        }
        .sb-cap:hover { background: var(--bg-4); color: var(--tx-1); border-color: var(--line-2); }
        .sb-cap-warn { background: color-mix(in oklch, var(--err) 20%, transparent); color: var(--err-text, var(--err)); }
        .sb-cap-up { background: color-mix(in oklch, var(--acc) 20%, transparent); color: var(--acc-text, var(--acc)); }

        .sb-db-desc { padding: 2px 12px 6px 30px; font-size: var(--tx-xs); color: var(--tx-4); line-height: 1.3; }
        .sb-tables { padding-bottom: 2px; }
        .sb-table { display: flex; align-items: stretch; position: relative; }
        .sb-table:hover { background: var(--bg-2); }
        .sb-table-head { display: flex; align-items: center; gap: 6px; flex: 1; padding: 3px 10px 3px 22px; color: var(--tx-2); font-size: var(--tx-sm); text-align: left; }
        .sb-table-name { flex: 1; font-family: var(--font-mono); font-size: 12px; color: var(--tx-1); }
        .sb-table-rows { font-size: 10.5px; color: var(--tx-4); font-family: var(--font-mono); }
        .sb-insert { width: 22px; opacity: 0; display: flex; align-items: center; justify-content: center; color: var(--tx-3); }
        .sb-table:hover .sb-insert { opacity: 1; }
        .sb-insert:hover { color: var(--acc); }
        .sb-cols { padding-bottom: 4px; }
        .sb-col { display: flex; align-items: center; gap: 6px; width: 100%; padding: 2px 10px 2px 40px; text-align: left; color: var(--tx-2); font-size: var(--tx-sm); }
        .sb-col:hover { background: var(--bg-2); color: var(--tx-1); }
        .sb-col-name { flex: 1; font-family: var(--font-mono); font-size: 11.5px; }
        .sb-col-type { font-size: 10.5px; color: var(--tx-4); }

        .sb-add-server {
          display: flex; align-items: center; gap: 8px; justify-content: center;
          margin: 10px 10px; padding: 7px 10px; width: calc(100% - 20px);
          border: 1px dashed var(--line-3); border-radius: var(--r-md);
          color: var(--tx-3); font-size: var(--tx-sm);
        }
        .sb-add-server:hover { background: var(--bg-2); color: var(--tx-1); border-color: var(--acc); }
      `}</style>
    </div>
  );
}

window.Sidebar = Sidebar;
window.fmtRows = fmtRows;
window.fmtCap = fmtCap;
