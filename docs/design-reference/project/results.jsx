// results.jsx — results table + subquery breakdown + row-limit warning

const { useState: useStateR } = React;

function fmtNumber(n, money) {
  if (typeof n !== 'number') return n;
  if (money) return n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return n.toLocaleString('en-IN');
}

function ResultsPanel({ state, onPromote }) {
  // state: 'empty' | 'running' | 'results' | 'error' | 'row-limit'
  const [sortCol, setSortCol] = useStateR(3);
  const [sortDir, setSortDir] = useStateR('desc');
  const [page] = useStateR(1);

  const rows = [...RESULT_ROWS].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  return (
    <div className="results-wrap">
      <div className="results-head">
        <div className="results-head-left">
          <span style={{ color: 'var(--tx-3)' }}>{I.table(13)}</span>
          <span className="editor-head-title">Results</span>
          {state === 'results' && (
            <>
              <span className="result-meta"><span className="dot ok" /> 6 rows</span>
              <span className="result-meta">· 624 ms</span>
              <span className="result-meta">· scanned 2.2M</span>
            </>
          )}
          {state === 'running' && (
            <span className="result-meta" style={{ color: 'var(--tx-2)' }}>
              <span style={{ color: 'var(--acc)' }}>{I.spinner(12)}</span>
              Running 3 sub-queries in parallel…
            </span>
          )}
          {state === 'error' && (
            <span className="result-meta" style={{ color: 'var(--err)' }}>
              <span>{I.err(12)}</span> Query failed
            </span>
          )}
          {state === 'row-limit' && (
            <span className="result-meta" style={{ color: 'var(--warn)' }}>
              <span>{I.warn(12)}</span> Row-limit warning — 1 sub-query near cap
            </span>
          )}
        </div>
        <div className="results-head-right">
          <button className="btn-ghost"><span>{I.filter(11)}</span> Filter</button>
          <button className="btn-ghost"><span>{I.download(11)}</span> CSV</button>
          <button className="btn-ghost" onClick={onPromote} title="Open full results view">
            <span>{I.more(12)}</span>
          </button>
        </div>
      </div>

      {state === 'empty' && (
        <div className="results-empty">
          <div className="empty-illus">
            <div className="empty-circle" />
            <div className="empty-square" />
            <div className="empty-line" />
          </div>
          <div className="empty-title">No results yet</div>
          <div className="empty-sub">Write a SQL query referencing tables from multiple databases — e.g. <span className="mono" style={{ color: 'var(--sx-db)' }}>ledger.transactions</span> joined with <span className="mono" style={{ color: 'var(--sx-db)' }}>on_boarding.customers</span> — and press <span className="kbd">⌘↵</span> to run.</div>
        </div>
      )}

      {state === 'running' && <RunningView />}

      {state === 'error' && <ErrorView />}

      {(state === 'results' || state === 'row-limit') && (
        <>
          {state === 'row-limit' && <RowLimitBanner />}
          <SubqueryStrip warning={state === 'row-limit'} />
          <div className="results-table-scroll">
            <table className="results-table">
              <thead>
                <tr>
                  <th className="row-idx">#</th>
                  {RESULT_COLUMNS.map((c, ci) => (
                    <th
                      key={c.name}
                      className={ci === sortCol ? `sorted ${sortDir}` : ''}
                      style={{ textAlign: c.align }}
                      onClick={() => {
                        if (sortCol === ci) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        else { setSortCol(ci); setSortDir('desc'); }
                      }}
                    >
                      <span className="th-inner">
                        <span>{c.name}</span>
                        <span className="th-type">{c.type}</span>
                        {ci === sortCol && <span className="th-sort">{I.sortAsc(10)}</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    <td className="row-idx">{ri + 1}</td>
                    {r.map((v, ci) => {
                      const col = RESULT_COLUMNS[ci];
                      const isNum = typeof v === 'number';
                      return (
                        <td key={ci} style={{ textAlign: col.align }}>
                          <span className={isNum ? 'mono' : ''} style={{ color: isNum ? 'var(--tx-1)' : 'var(--tx-2)' }}>
                            {col.money && <span style={{ color: 'var(--tx-4)', marginRight: 4 }}>₹</span>}
                            {fmtNumber(v, col.money)}
                          </span>
                          {ci === 2 && <BarCell value={v} max={488101} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ResultsFooter />
        </>
      )}

      <style>{`
        .results-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; background: var(--bg-0); }
        .results-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px 6px 12px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--line-1);
          min-height: 36px;
        }
        .results-head-left { display: flex; align-items: center; gap: 8px; }
        .results-head-right { display: flex; align-items: center; gap: 4px; }
        .result-meta { font-size: var(--tx-xs); color: var(--tx-3); display: inline-flex; align-items: center; gap: 4px; margin-left: 2px; }
        .btn-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: var(--r-md); color: var(--tx-2); font-size: var(--tx-sm); }
        .btn-ghost:hover { background: var(--bg-3); color: var(--tx-1); }

        .results-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 40px 24px; gap: 6px;
        }
        .empty-title { color: var(--tx-1); font-size: var(--tx-lg); font-weight: 500; margin-top: 12px; }
        .empty-sub { color: var(--tx-3); max-width: 440px; font-size: var(--tx-sm); line-height: 1.5; text-wrap: pretty; }
        .empty-illus { display: flex; gap: 8px; align-items: center; color: var(--tx-4); }
        .empty-circle { width: 28px; height: 28px; border: 1.5px dashed currentColor; border-radius: 999px; }
        .empty-square { width: 28px; height: 28px; border: 1.5px dashed currentColor; border-radius: 4px; }
        .empty-line { width: 28px; height: 2px; background: currentColor; border-radius: 999px; }

        .results-table-scroll { flex: 1; overflow: auto; }
        .results-table {
          width: 100%; border-collapse: collapse; font-size: var(--tx-sm);
        }
        .results-table thead { position: sticky; top: 0; z-index: 2; }
        .results-table th {
          background: var(--bg-1);
          border-bottom: 1px solid var(--line-2);
          padding: var(--pad-row) var(--pad-cell);
          font-weight: 500; color: var(--tx-2); text-align: left;
          cursor: pointer; user-select: none;
          position: relative; white-space: nowrap;
        }
        .results-table th:hover { background: var(--bg-2); }
        .results-table th.sorted { color: var(--tx-1); background: var(--bg-2); }
        .results-table th:not(:last-child) { border-right: 1px solid var(--line-1); }
        .th-inner { display: inline-flex; align-items: center; gap: 6px; }
        .th-type { font-size: 10.5px; color: var(--tx-4); font-family: var(--font-mono); }
        .th-sort { color: var(--acc); }
        .row-idx {
          width: 36px; color: var(--tx-4) !important; font-family: var(--font-mono); font-size: 11px;
          text-align: right; border-right: 1px solid var(--line-1); background: var(--bg-1);
          position: sticky; left: 0; z-index: 1;
        }
        .results-table td {
          padding: var(--pad-row) var(--pad-cell);
          border-bottom: 1px solid var(--line-1);
          color: var(--tx-1);
          white-space: nowrap;
          position: relative;
        }
        .results-table tbody tr:hover td { background: var(--bg-2); }
        .results-table tbody tr:hover .row-idx { background: var(--bg-2); color: var(--tx-2) !important; }
      `}</style>
    </div>
  );
}

function BarCell({ value, max }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{
      position: 'absolute', right: 'var(--pad-cell)', bottom: 2,
      width: 40, height: 2, background: 'var(--line-1)', borderRadius: 2,
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--acc)', borderRadius: 2, opacity: .7 }} />
    </div>
  );
}

function SubqueryStrip({ warning }) {
  return (
    <div className="sq-strip">
      {SUBQUERY_STATS.map((s, i) => {
        const near = warning && i === 0;
        const pct = Math.min(100, (s.rows / s.limit) * 100);
        return (
          <div key={s.db} className={`sq-card ${near ? 'sq-warn' : ''}`}>
            <div className="sq-row">
              <span style={{ color: 'var(--sx-db)' }}>{I.db(11)}</span>
              <span className="mono sq-name">{s.db}</span>
              <span className="sq-ms mono">{s.ms}ms</span>
            </div>
            <div className="sq-bar-outer"><div className="sq-bar-inner" style={{ width: `${near ? 94 : pct}%`, background: near ? 'var(--warn)' : 'var(--acc)' }} /></div>
            <div className="sq-row sq-sub">
              <span>{near ? '47,112' : fmtRows(s.rows)} rows</span>
              <span style={{ color: 'var(--tx-4)' }}>/ {fmtRows(s.limit)} cap</span>
              {near && <span style={{ color: 'var(--warn)', marginLeft: 'auto' }}>{I.warn(11)}</span>}
            </div>
          </div>
        );
      })}
      <div className="sq-card sq-duckdb">
        <div className="sq-row">
          <span style={{ color: 'var(--ok)' }}>{I.bolt(11)}</span>
          <span className="mono sq-name">DuckDB merge</span>
          <span className="sq-ms mono">18ms</span>
        </div>
        <div className="sq-row sq-sub"><span>3 frames → 6 rows</span></div>
      </div>
      <style>{`
        .sq-strip {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 6px; padding: 8px 12px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--line-1);
        }
        .sq-card {
          background: var(--bg-2); border: 1px solid var(--line-1);
          border-radius: var(--r-md); padding: 6px 8px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .sq-warn { border-color: color-mix(in oklch, var(--warn) 50%, var(--line-2)); background: color-mix(in oklch, var(--warn) 7%, var(--bg-2)); }
        .sq-duckdb { background: color-mix(in oklch, var(--ok) 6%, var(--bg-2)); border-color: color-mix(in oklch, var(--ok) 25%, var(--line-2)); }
        .sq-row { display: flex; align-items: center; gap: 6px; font-size: var(--tx-xs); }
        .sq-name { color: var(--tx-1); font-size: 11.5px; flex: 1; }
        .sq-ms { color: var(--tx-3); font-size: 10.5px; }
        .sq-sub { color: var(--tx-3); font-size: 10.5px; }
        .sq-bar-outer { height: 2px; background: var(--line-1); border-radius: 2px; overflow: hidden; }
        .sq-bar-inner { height: 100%; }
      `}</style>
    </div>
  );
}

function RowLimitBanner() {
  return (
    <div className="banner banner-warn">
      <span>{I.warn(14)}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>Sub-query on <span className="mono" style={{ color: 'var(--sx-db)' }}>ledger.transactions</span> returned 47,112 rows — near the 50,000 cap.</div>
        <div style={{ color: 'var(--tx-3)', fontSize: 'var(--tx-xs)', marginTop: 2 }}>Results may be truncated. Add a tighter <span className="mono">WHERE</span> on the ledger side before relying on these numbers.</div>
      </div>
      <button className="btn-ghost" style={{ color: 'var(--warn-text)' }}>Add filter</button>
      <button className="btn-ghost">Dismiss</button>
      <style>{`
        .banner {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 8px 12px; border-bottom: 1px solid var(--line-1);
          font-size: var(--tx-sm);
        }
        .banner-warn { background: var(--warn-soft); color: var(--warn-text); border-bottom-color: color-mix(in oklch, var(--warn) 30%, var(--line-1)); }
      `}</style>
    </div>
  );
}

function ResultsFooter() {
  return (
    <div className="res-foot">
      <div className="res-foot-left">
        <span>Showing <b style={{ color: 'var(--tx-1)' }}>1–6</b> of 6</span>
        <span className="res-foot-sep">·</span>
        <span>Page 1 / 1</span>
      </div>
      <div className="res-foot-right">
        <span>Server <span className="mono" style={{ color: 'var(--tx-2)' }}>vegapay-sandbox-postgres-server</span></span>
      </div>
      <style>{`
        .res-foot {
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 12px;
          background: var(--bg-1);
          border-top: 1px solid var(--line-1);
          font-size: var(--tx-xs); color: var(--tx-3);
        }
        .res-foot-sep { margin: 0 6px; color: var(--tx-4); }
      `}</style>
    </div>
  );
}

function RunningView() {
  return (
    <div className="running">
      <div className="running-title">Dispatching sub-queries…</div>
      <div className="running-list">
        {SUBQUERY_STATS.map((s, i) => (
          <div key={s.db} className="running-item">
            <span style={{ color: 'var(--sx-db)' }}>{I.db(12)}</span>
            <span className="mono" style={{ color: 'var(--tx-1)', width: 160 }}>{s.db}</span>
            <div className="running-bar"><div className="running-bar-fill" style={{ animationDelay: `${i * 120}ms` }} /></div>
            <span style={{ color: 'var(--tx-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.ms}ms</span>
          </div>
        ))}
        <div className="running-item">
          <span style={{ color: 'var(--ok)' }}>{I.bolt(12)}</span>
          <span className="mono" style={{ color: 'var(--tx-1)', width: 160 }}>DuckDB merge</span>
          <div className="running-bar"><div className="running-bar-fill" style={{ animationDelay: '420ms', background: 'var(--ok)' }} /></div>
          <span style={{ color: 'var(--tx-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>queued</span>
        </div>
      </div>
      <style>{`
        .running { padding: 24px 28px; display: flex; flex-direction: column; gap: 12px; }
        .running-title { font-size: var(--tx-md); color: var(--tx-2); }
        .running-list { display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
        .running-item { display: flex; align-items: center; gap: 10px; font-size: var(--tx-sm); }
        .running-bar { flex: 1; height: 3px; background: var(--line-1); border-radius: 3px; overflow: hidden; }
        @keyframes run-fill {
          0% { transform: translateX(-100%); }
          60% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        .running-bar-fill {
          width: 100%; height: 100%; background: var(--acc);
          animation: run-fill 1.6s cubic-bezier(.2,.7,.3,1) infinite;
        }
      `}</style>
    </div>
  );
}

function ErrorView() {
  return (
    <div className="err-view">
      <div className="err-head">
        <span style={{ color: 'var(--err)' }}>{I.err(16)}</span>
        <div>
          <div className="err-title">SQL parse error</div>
          <div className="err-sub">The query could not be split across databases.</div>
        </div>
      </div>
      <div className="err-msg mono">
        <span style={{ color: 'var(--tx-4)' }}>line 4, col 8: </span>
        unknown database <span style={{ color: 'var(--err)' }}>orders</span> referenced —
        available: <span style={{ color: 'var(--sx-db)' }}>account_management</span>, <span style={{ color: 'var(--sx-db)' }}>on_boarding</span>, <span style={{ color: 'var(--sx-db)' }}>cards</span>, <span style={{ color: 'var(--sx-db)' }}>ledger</span>, <span style={{ color: 'var(--sx-db)' }}>rewards</span>
      </div>
      <div className="err-hint">
        Did you mean <button className="link">ledger.transactions</button>? Connections are defined in <span className="mono">~/.crossql/connections.yaml</span>.
      </div>
      <style>{`
        .err-view { padding: 22px 28px; display: flex; flex-direction: column; gap: 12px; max-width: 680px; }
        .err-head { display: flex; gap: 10px; align-items: flex-start; }
        .err-title { font-size: var(--tx-lg); font-weight: 500; color: var(--tx-1); }
        .err-sub { font-size: var(--tx-sm); color: var(--tx-3); margin-top: 2px; }
        .err-msg {
          padding: 10px 12px; background: var(--err-soft);
          border: 1px solid color-mix(in oklch, var(--err) 40%, var(--line-2));
          border-radius: var(--r-md); color: var(--err-text); font-size: 12px; line-height: 1.5;
        }
        .err-hint { font-size: var(--tx-sm); color: var(--tx-3); }
        .link { color: var(--acc-text); text-decoration: underline; text-decoration-color: color-mix(in oklch, var(--acc) 40%, transparent); }
        .link:hover { text-decoration-color: var(--acc); }
      `}</style>
    </div>
  );
}

window.ResultsPanel = ResultsPanel;
