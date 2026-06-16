// servers.jsx — Server→DB model with auto-discovery + caps

const SERVERS = [
  {
    id: 'srv-sandbox',
    name: 'vegapay-sandbox',
    host: 'vegapay-sandbox-postgres-server.postgres.database.azure.com',
    port: 5432,
    user: 'postgres',
    ssl: true,
    envId: 'sandbox',
    addedAt: '2026-03-12',
    lastSync: '2 min ago',
    version: 'PostgreSQL 15.4',
    // auto-discovered
    discovered: [
      { name: 'account_management', included: true, cap: 50000, tables: 3, size: '2.4 GB', latencyMs: 42 },
      { name: 'on_boarding',        included: true, cap: 50000, tables: 3, size: '8.1 GB', latencyMs: 58 },
      { name: 'cards',              included: true, cap: 50000, tables: 2, size: '1.2 GB', latencyMs: 38 },
      { name: 'ledger',             included: true, cap: 200000, tables: 3, size: '142 GB', latencyMs: 91, capRaised: true },
      { name: 'rewards',            included: true, cap: 50000, tables: 2, size: '6.8 GB', latencyMs: 44 },
      { name: 'notifications',      included: false, cap: 50000, tables: 4, size: '512 MB', latencyMs: 36 },
      { name: 'analytics_readonly', included: false, cap: 50000, tables: 12, size: '44 GB', latencyMs: 120 },
      { name: 'postgres',           included: false, cap: 50000, tables: 0, size: '8 MB', latencyMs: 12, system: true },
      { name: 'azure_maintenance',  included: false, cap: 50000, tables: 0, size: '14 MB', latencyMs: 14, system: true },
    ],
  },
];

window.SERVERS = SERVERS;

// ---------------- Connect Server Modal ----------------
function ConnectServerModal({ onClose, onConnected }) {
  const [stage, setStage] = React.useState('form'); // form | testing | discovered | saved
  const [form, setForm] = React.useState({
    name: 'vegapay-sandbox',
    host: 'vegapay-sandbox-postgres-server.postgres.database.azure.com',
    port: 5432,
    user: 'postgres',
    password: '••••••••••••',
    ssl: true,
    auth: 'password',
    envId: 'sandbox',
  });
  const [dbs, setDbs] = React.useState([]);

  const testConnect = () => {
    setStage('testing');
    setTimeout(() => {
      setDbs(SERVERS[0].discovered.map(d => ({
        ...d,
        included: !d.system && d.name !== 'analytics_readonly' && d.name !== 'notifications',
      })));
      setStage('discovered');
    }, 1400);
  };

  const toggle = (name) => setDbs(ds => ds.map(d => d.name === name ? { ...d, included: !d.included } : d));
  const save = () => { setStage('saved'); setTimeout(onConnected, 700); };

  return (
    <div className="ov-backdrop" onClick={onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        <div className="cs-head">
          <div>
            <div className="cs-title">
              {stage === 'form' && 'Connect a Postgres server'}
              {stage === 'testing' && 'Testing connection…'}
              {stage === 'discovered' && 'Databases on this server'}
              {stage === 'saved' && 'Server connected'}
            </div>
            <div className="cs-sub">
              {stage === 'form' && "CrossQL will auto-detect all databases — you pick which ones to include."}
              {stage === 'testing' && 'Running pg_database query to list available databases.'}
              {stage === 'discovered' && `Found ${dbs.length} databases. Selected ones will appear in the schema sidebar.`}
              {stage === 'saved' && `${dbs.filter(d => d.included).length} databases added to ${form.envId}.`}
            </div>
          </div>
          <button className="sb-icon-btn" onClick={onClose}>{I.close(12)}</button>
        </div>

        <div className="cs-body">
          {stage === 'form' && (
            <div className="cs-form">
              <Field label="Display name">
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </Field>
              <Field label="Environment">
                <div className="cs-seg">
                  {ENVIRONMENTS.map(e => (
                    <button key={e.id} className={`cs-seg-opt ${form.envId === e.id ? 'cs-seg-opt-a' : ''}`}
                      onClick={() => setForm({...form, envId: e.id})}>
                      <span className="env-dot" style={{ background: e.color, width: 7, height: 7 }} />
                      {e.label}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="cs-row">
                <Field label="Host" grow>
                  <input className="mono" value={form.host} onChange={e => setForm({...form, host: e.target.value})} />
                </Field>
                <Field label="Port" width={90}>
                  <input className="mono" value={form.port} onChange={e => setForm({...form, port: e.target.value})} />
                </Field>
              </div>
              <Field label="Authentication">
                <div className="cs-seg">
                  {[['password','Password'],['azuread','Azure AD'],['iam','IAM token']].map(([v,l]) => (
                    <button key={v} className={`cs-seg-opt ${form.auth === v ? 'cs-seg-opt-a' : ''}`}
                      onClick={() => setForm({...form, auth: v})}>{l}</button>
                  ))}
                </div>
              </Field>
              <div className="cs-row">
                <Field label="User" grow>
                  <input className="mono" value={form.user} onChange={e => setForm({...form, user: e.target.value})} />
                </Field>
                <Field label="Password" grow>
                  <input className="mono" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                </Field>
              </div>
              <Field label="Options">
                <label className="cs-check">
                  <input type="checkbox" checked={form.ssl} onChange={e => setForm({...form, ssl: e.target.checked})} />
                  <span>Require SSL (<span className="mono">sslmode=require</span>)</span>
                </label>
              </Field>
              <div className="cs-hint">
                <span style={{ color: 'var(--info)' }}>{I.info(13)}</span>
                Credentials are stored locally in <span className="mono" style={{ color: 'var(--tx-2)' }}>~/.crossql/connections.yaml</span>. CrossQL will never list databases you don't include.
              </div>
            </div>
          )}

          {stage === 'testing' && (
            <div className="cs-testing">
              {['TCP connect','TLS handshake','Authenticate','List databases (pg_database)'].map((step, i) => (
                <div key={step} className="cs-test-step">
                  <span style={{ color: 'var(--ok)' }}>{I.check(13)}</span>
                  <span>{step}</span>
                  <span className="cs-test-ms mono">{28 + i * 40}ms</span>
                </div>
              ))}
              <div className="cs-test-step">
                <span style={{ color: 'var(--acc)' }}>{I.spinner(13)}</span>
                <span>Scanning schemas…</span>
                <span className="cs-test-ms mono">—</span>
              </div>
            </div>
          )}

          {stage === 'discovered' && (
            <div className="cs-discovered">
              <div className="cs-disc-toolbar">
                <div className="cs-disc-meta">
                  <span style={{ color: 'var(--ok)' }}>{I.check(13)}</span>
                  Connected to <span className="mono" style={{ color: 'var(--tx-1)' }}>{form.host}</span>
                  <span style={{ color: 'var(--tx-4)' }}>· PostgreSQL 15.4</span>
                </div>
                <div className="cs-disc-actions">
                  <button className="btn-ghost" onClick={() => setDbs(ds => ds.map(d => ({...d, included: !d.system})))}>Select all</button>
                  <button className="btn-ghost" onClick={() => setDbs(ds => ds.map(d => ({...d, included: false})))}>None</button>
                </div>
              </div>

              <div className="cs-disc-list">
                {dbs.map(d => (
                  <label key={d.name} className={`cs-db-row ${d.included ? 'cs-db-on' : ''} ${d.system ? 'cs-db-system' : ''}`}>
                    <input type="checkbox" checked={d.included} onChange={() => toggle(d.name)} disabled={d.system} />
                    <span style={{ color: d.included ? 'var(--sx-db)' : 'var(--tx-4)' }}>{I.db(14)}</span>
                    <div className="cs-db-main">
                      <div className="cs-db-name mono">
                        {d.name}
                        {d.system && <span className="cs-chip">system</span>}
                      </div>
                      <div className="cs-db-meta">
                        {d.tables} tables · {d.size} · <span style={{ color: d.latencyMs > 80 ? 'var(--warn)' : 'var(--tx-3)' }}>{d.latencyMs}ms</span>
                      </div>
                    </div>
                    <div className="cs-db-cap">
                      <span style={{ color: 'var(--tx-4)', fontSize: 10.5 }}>row cap</span>
                      <span className="mono" style={{ color: d.included ? 'var(--tx-1)' : 'var(--tx-4)' }}>{(d.cap/1000).toFixed(0)}K</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="cs-disc-foot">
                <span><b style={{ color: 'var(--tx-1)' }}>{dbs.filter(d => d.included).length}</b> of {dbs.length} selected</span>
                <span style={{ color: 'var(--tx-4)' }}>· Excluded DBs won't appear in autocomplete or the sidebar. You can re-scan anytime.</span>
              </div>
            </div>
          )}

          {stage === 'saved' && (
            <div className="cs-saved">
              <div style={{ color: 'var(--ok)' }}>{I.check(28)}</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>All set</div>
            </div>
          )}
        </div>

        <div className="cs-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          {stage === 'form' && <button className="btn btn-primary" onClick={testConnect}>Test & discover</button>}
          {stage === 'discovered' && (
            <>
              <button className="btn-ghost" onClick={() => setStage('form')}>← Edit connection</button>
              <button className="btn btn-primary" onClick={save}>Add {dbs.filter(d => d.included).length} databases</button>
            </>
          )}
        </div>

        <style>{`
          .cs-modal {
            width: 620px; max-height: 86vh;
            background: var(--bg-2); border: 1px solid var(--line-2);
            border-radius: var(--r-xl); box-shadow: var(--shadow-overlay);
            display: flex; flex-direction: column; overflow: hidden;
            margin-top: 6vh; align-self: flex-start;
          }
          .cs-head { display: flex; padding: 16px 18px 12px; gap: 12px; align-items: flex-start; border-bottom: 1px solid var(--line-1); }
          .cs-title { font-size: 15px; font-weight: 600; color: var(--tx-1); }
          .cs-sub { font-size: var(--tx-sm); color: var(--tx-3); margin-top: 3px; max-width: 480px; }
          .cs-body { flex: 1; overflow-y: auto; padding: 14px 18px; }
          .cs-foot { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line-1); background: var(--bg-1); }

          .cs-form { display: flex; flex-direction: column; gap: 10px; }
          .cs-row { display: flex; gap: 10px; }
          .cs-field { display: flex; flex-direction: column; gap: 4px; }
          .cs-field-label { font-size: var(--tx-xs); color: var(--tx-3); font-weight: 500; }
          .cs-field input {
            background: var(--bg-input); border: 1px solid var(--line-2);
            border-radius: var(--r-md); padding: 6px 10px; color: var(--tx-1);
            font-size: var(--tx-sm); outline: 0;
          }
          .cs-field input:focus { border-color: var(--acc); }
          .cs-seg { display: flex; gap: 3px; background: var(--bg-1); border: 1px solid var(--line-2); border-radius: var(--r-md); padding: 3px; width: fit-content; }
          .cs-seg-opt { display: inline-flex; gap: 6px; align-items: center; padding: 5px 10px; border-radius: calc(var(--r-md) - 2px); color: var(--tx-3); font-size: var(--tx-sm); }
          .cs-seg-opt:hover { color: var(--tx-1); }
          .cs-seg-opt-a { background: var(--bg-3); color: var(--tx-1); }
          .cs-check { display: flex; gap: 7px; align-items: center; font-size: var(--tx-sm); color: var(--tx-2); cursor: pointer; }
          .cs-hint { margin-top: 4px; padding: 10px 12px; background: var(--info-soft); border: 1px solid color-mix(in oklch, var(--info) 35%, var(--line-1)); border-radius: var(--r-md); font-size: var(--tx-xs); color: var(--tx-2); line-height: 1.5; display: flex; gap: 8px; align-items: flex-start; }

          .cs-testing { display: flex; flex-direction: column; gap: 8px; padding: 10px 0; }
          .cs-test-step { display: flex; align-items: center; gap: 10px; font-size: var(--tx-sm); color: var(--tx-2); }
          .cs-test-ms { margin-left: auto; color: var(--tx-4); font-size: 11px; }

          .cs-disc-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
          .cs-disc-meta { display: flex; align-items: center; gap: 6px; font-size: var(--tx-xs); color: var(--tx-3); }
          .cs-disc-actions { display: flex; gap: 4px; }
          .cs-disc-list { display: flex; flex-direction: column; gap: 3px; border: 1px solid var(--line-1); border-radius: var(--r-md); padding: 4px; background: var(--bg-1); }
          .cs-db-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-sm); cursor: pointer; }
          .cs-db-row:hover { background: var(--bg-3); }
          .cs-db-on { background: color-mix(in oklch, var(--acc) 6%, transparent); }
          .cs-db-on:hover { background: color-mix(in oklch, var(--acc) 12%, transparent); }
          .cs-db-system { opacity: .55; }
          .cs-db-main { flex: 1; min-width: 0; }
          .cs-db-name { font-size: var(--tx-sm); color: var(--tx-1); display: flex; gap: 6px; align-items: center; }
          .cs-db-meta { font-size: var(--tx-xs); color: var(--tx-3); margin-top: 1px; }
          .cs-chip { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; padding: 1px 5px; border-radius: 3px; background: var(--bg-3); color: var(--tx-4); }
          .cs-db-cap { display: flex; flex-direction: column; align-items: flex-end; font-size: var(--tx-sm); }
          .cs-disc-foot { margin-top: 8px; font-size: var(--tx-xs); color: var(--tx-3); }
          .cs-saved { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 0; }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children, grow, width }) {
  return (
    <div className="cs-field" style={{ flex: grow ? 1 : 'initial', width }}>
      <div className="cs-field-label">{label}</div>
      {children}
    </div>
  );
}

// ---------------- Cap editor popover ----------------
function CapPopover({ anchor, db, onClose, onSave }) {
  const [cap, setCap] = React.useState(db.cap);
  const [unlimited, setUnlimited] = React.useState(false);
  const presets = [10000, 50000, 100000, 200000, 500000, 1000000];
  return (
    <div className="cap-backdrop" onClick={onClose}>
      <div className="cap-pop" onClick={e => e.stopPropagation()}>
        <div className="cap-head">
          <div>
            <div style={{ fontSize: var_txt_sm, fontWeight: 600 }}>Row cap · <span className="mono" style={{ color: 'var(--sx-db)' }}>{db.name}</span></div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Max rows per sub-query to this database.</div>
          </div>
          <button className="sb-icon-btn" onClick={onClose}>{I.close(12)}</button>
        </div>
        <div className="cap-body">
          <label className="cap-toggle">
            <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} />
            <span>No cap <span style={{ color: 'var(--warn)', fontSize: 11, marginLeft: 6 }}>{I.warn(11)} may fetch full tables</span></span>
          </label>
          <div className={`cap-controls ${unlimited ? 'cap-disabled' : ''}`}>
            <div className="cap-value">
              <input type="number" className="mono" value={cap} onChange={e => setCap(+e.target.value)} disabled={unlimited} />
              <span style={{ color: 'var(--tx-3)', fontSize: var_txt_sm }}>rows</span>
            </div>
            <div className="cap-presets">
              {presets.map(p => (
                <button key={p} className={`cap-preset ${cap === p ? 'cap-preset-a' : ''}`} onClick={() => setCap(p)} disabled={unlimited}>
                  {p >= 1000000 ? `${p/1000000}M` : `${p/1000}K`}
                </button>
              ))}
            </div>
            <div className="cap-hist">
              <div className="cap-hist-label">Last 7 days · rows returned</div>
              <svg viewBox="0 0 240 40" className="cap-hist-svg">
                <line x1="0" y1={40 - (cap / 1000000) * 40} x2="240" y2={40 - (cap / 1000000) * 40}
                  stroke="var(--warn)" strokeDasharray="3 3" strokeWidth="1" opacity=".7" />
                {[12, 34, 28, 41, 19, 47, 38].map((v, i) => (
                  <rect key={i} x={i * 34 + 4} y={40 - v * 0.8} width="26" height={v * 0.8}
                    fill={v > 40 ? 'var(--warn)' : 'var(--acc)'} opacity=".7" rx="1" />
                ))}
              </svg>
            </div>
          </div>
          <div className="cap-foot">
            <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Applies to sandbox env only</span>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { onSave(unlimited ? 0 : cap); onClose(); }}>Save</button>
          </div>
        </div>
        <style>{`
          .cap-backdrop { position: fixed; inset: 0; z-index: 210; }
          .cap-pop {
            position: absolute; top: 140px; left: 280px;
            width: 340px; background: var(--bg-2); border: 1px solid var(--line-2);
            border-radius: var(--r-lg); box-shadow: var(--shadow-overlay);
          }
          .cap-head { display: flex; gap: 10px; padding: 12px 12px 10px; border-bottom: 1px solid var(--line-1); align-items: flex-start; }
          .cap-head > div:first-child { flex: 1; }
          .cap-body { padding: 10px 12px 10px; display: flex; flex-direction: column; gap: 10px; }
          .cap-toggle { display: flex; gap: 7px; align-items: center; font-size: var(--tx-sm); color: var(--tx-2); }
          .cap-controls { display: flex; flex-direction: column; gap: 8px; }
          .cap-disabled { opacity: .4; pointer-events: none; }
          .cap-value { display: flex; gap: 8px; align-items: center; }
          .cap-value input { flex: 1; background: var(--bg-input); border: 1px solid var(--line-2); border-radius: var(--r-md); padding: 6px 10px; font-size: var(--tx-md); color: var(--tx-1); font-family: var(--font-mono); outline: 0; }
          .cap-value input:focus { border-color: var(--acc); }
          .cap-presets { display: flex; gap: 4px; flex-wrap: wrap; }
          .cap-preset { padding: 3px 8px; border-radius: var(--r-sm); background: var(--bg-1); border: 1px solid var(--line-2); color: var(--tx-2); font-family: var(--font-mono); font-size: 11px; }
          .cap-preset:hover { background: var(--bg-3); color: var(--tx-1); }
          .cap-preset-a { background: var(--acc-soft); border-color: var(--acc-line); color: var(--acc-text); }
          .cap-hist { border-top: 1px solid var(--line-1); padding-top: 8px; }
          .cap-hist-label { font-size: 10.5px; color: var(--tx-4); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
          .cap-hist-svg { width: 100%; height: 40px; }
          .cap-foot { display: flex; gap: 8px; align-items: center; padding: 8px 0 0; border-top: 1px solid var(--line-1); margin-top: 4px; padding-top: 10px; }
          .cap-foot .btn-ghost, .cap-foot .btn { padding: 4px 10px; font-size: var(--tx-sm); }
        `}</style>
      </div>
    </div>
  );
}
// small helper -- can't use CSS var directly in inline style value above
const var_txt_sm = 'var(--tx-sm)';

window.ConnectServerModal = ConnectServerModal;
window.CapPopover = CapPopover;
