// python.jsx — Python analysis cell + chart output

function PythonCell({ state }) {
  // state: 'idle' | 'output' | 'chart'
  return (
    <div className="py-wrap">
      <div className="py-head">
        <div className="py-head-left">
          <span style={{ color: 'var(--sx-db)' }}>{I.python(13)}</span>
          <span className="editor-head-title">Python cell</span>
          <span className="editor-head-sub">
            <span className="mono" style={{ color: 'var(--sx-db)' }}>df</span>
            <span style={{ color: 'var(--tx-4)' }}> · </span>
            <span className="mono" style={{ color: 'var(--sx-db)' }}>df_ledger</span>
            <span style={{ color: 'var(--tx-4)' }}> · </span>
            <span className="mono" style={{ color: 'var(--sx-db)' }}>df_account_management</span>
            <span style={{ color: 'var(--tx-4)' }}> · </span>
            <span className="mono" style={{ color: 'var(--sx-db)' }}>df_on_boarding</span>
          </span>
        </div>
        <div className="py-head-right">
          <span className="py-meta">sandboxed · 10s timeout</span>
          <button className="btn btn-primary py-run">{I.play(10)} Run <span className="kbd" style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: 'rgba(255,255,255,.8)' }}>⇧↵</span></button>
        </div>
      </div>

      <div className="py-body">
        <div className="py-code mono">
          <PythonHighlight src={PYTHON_CODE} />
        </div>

        {state === 'output' && <PythonOutput />}
        {state === 'chart' && <PythonChart />}
      </div>

      <style>{`
        .py-wrap { display: flex; flex-direction: column; background: var(--bg-0); min-height: 0; }
        .py-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px 6px 12px;
          background: var(--bg-1); border-bottom: 1px solid var(--line-1);
          min-height: 36px;
        }
        .py-head-left { display: flex; align-items: center; gap: 8px; }
        .py-head-right { display: flex; align-items: center; gap: 8px; }
        .py-meta { font-size: var(--tx-xs); color: var(--tx-3); }
        .py-run { padding: 4px 8px; font-size: var(--tx-sm); }
        .py-body { display: flex; flex-direction: column; }
        .py-code {
          padding: 12px 14px 12px 52px; position: relative;
          font-size: 12.5px; line-height: 20px; white-space: pre;
          color: var(--tx-1);
          background: var(--bg-0);
          border-bottom: 1px solid var(--line-1);
        }
        .py-code::before {
          content: 'In [1]:';
          position: absolute; left: 10px; top: 12px;
          font-family: var(--font-mono); font-size: 11px; color: var(--tx-4);
        }
      `}</style>
    </div>
  );
}

function PythonHighlight({ src }) {
  // very small py highlighter
  const KW = new Set(['import','from','as','def','return','if','else','elif','for','in','not','and','or','True','False','None','lambda','class']);
  const out = [];
  const re = /(#[^\n]*|'[^']*'|"[^"]*"|\b\d+\.?\d*\b|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|[^\w\s])/g;
  let m; let key = 0;
  while ((m = re.exec(src)) !== null) {
    const t = m[0];
    let style = {};
    if (t.startsWith('#')) style = { color: 'var(--sx-comment)', fontStyle: 'italic' };
    else if (/^['"]/.test(t)) style = { color: 'var(--sx-string)' };
    else if (/^\d/.test(t)) style = { color: 'var(--sx-number)' };
    else if (KW.has(t)) style = { color: 'var(--sx-keyword)', fontWeight: 600 };
    else if (/^[A-Za-z_]/.test(t)) {
      if (['df','df_ledger','df_account_management','df_on_boarding','pivot','pd'].includes(t)) style = { color: 'var(--sx-db)' };
      else if (['pivot_table','sort_values','round','sum'].includes(t)) style = { color: 'var(--sx-fn)' };
    } else if (/[=+\-*\/(){}\[\],:]/.test(t)) style = { color: 'var(--sx-operator)' };
    out.push(<span key={key++} style={style}>{t}</span>);
  }
  return <>{out}</>;
}

function PythonOutput() {
  const rows = PYTHON_OUTPUT;
  return (
    <div className="py-out">
      <div className="py-out-head">
        <span className="mono" style={{ color: 'var(--tx-4)' }}>Out [1]:</span>
        <span className="py-out-type">DataFrame · 6 rows × 4 cols</span>
      </div>
      <div className="py-out-table-wrap">
        <table className="py-out-table">
          <thead>
            <tr>
              {rows[0].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((r, ri) => (
              <tr key={ri}>
                {r.map((v, ci) => (
                  <td key={ci} className="mono" style={{ textAlign: ci === 0 ? 'left' : 'right' }}>
                    {typeof v === 'number'
                      ? (ci === 2 ? '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : v.toLocaleString('en-IN'))
                      : v}
                    {ci === 3 && <span style={{ color: 'var(--tx-4)' }}>%</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .py-out { padding: 10px 14px 14px; }
        .py-out-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: var(--tx-xs); }
        .py-out-type { color: var(--tx-3); }
        .py-out-table-wrap {
          border: 1px solid var(--line-1); border-radius: var(--r-md);
          overflow: hidden; max-width: 620px;
        }
        .py-out-table { width: 100%; border-collapse: collapse; font-size: var(--tx-sm); }
        .py-out-table th {
          background: var(--bg-2); padding: 5px 10px; font-weight: 500;
          color: var(--tx-2); border-bottom: 1px solid var(--line-1);
          font-family: var(--font-mono); font-size: 11.5px;
        }
        .py-out-table td { padding: 5px 10px; border-bottom: 1px solid var(--line-1); color: var(--tx-1); font-size: 11.5px; }
        .py-out-table tbody tr:last-child td { border-bottom: 0; }
        .py-out-table tbody tr:hover td { background: var(--bg-2); }
      `}</style>
    </div>
  );
}

function PythonChart() {
  const data = PYTHON_OUTPUT.slice(1);
  const max = Math.max(...data.map(r => r[2]));
  return (
    <div className="py-chart">
      <div className="py-out-head">
        <span className="mono" style={{ color: 'var(--tx-4)' }}>Out [2]:</span>
        <span className="py-out-type">matplotlib · share_pct by risk_tier</span>
      </div>
      <svg viewBox="0 0 520 180" className="py-chart-svg">
        {data.map((r, i) => {
          const h = (r[2] / max) * 130;
          const x = 40 + i * 72;
          return (
            <g key={i}>
              <rect x={x} y={160 - h} width="44" height={h} fill="var(--acc)" opacity=".85" rx="2" />
              <text x={x + 22} y="175" textAnchor="middle" fontSize="10" fill="var(--tx-3)" fontFamily="var(--font-mono)">{r[0]}</text>
              <text x={x + 22} y={160 - h - 4} textAnchor="middle" fontSize="10" fill="var(--tx-1)" fontFamily="var(--font-mono)">{r[3]}%</text>
            </g>
          );
        })}
        <line x1="40" y1="160" x2="490" y2="160" stroke="var(--line-2)" strokeWidth="1" />
      </svg>
      <style>{`
        .py-chart { padding: 10px 14px 14px; }
        .py-chart-svg { width: 100%; max-width: 560px; height: 180px; }
      `}</style>
    </div>
  );
}

window.PythonCell = PythonCell;
