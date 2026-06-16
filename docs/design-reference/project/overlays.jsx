// overlays.jsx — env-switch validation, command palette, tweaks panel

const { useState: useStateO, useEffect: useEffectO } = React;

function EnvValidateOverlay({ targetEnv, onDone, onCancel }) {
  const [stage, setStage] = useStateO(0); // 0..5: validating dbs, 5 = done
  useEffectO(() => {
    if (!targetEnv) return;
    setStage(0);
    const ids = [];
    for (let i = 1; i <= DATABASES.length; i++) {
      ids.push(setTimeout(() => setStage(i), 260 * i));
    }
    ids.push(setTimeout(() => onDone(), 260 * DATABASES.length + 420));
    return () => ids.forEach(clearTimeout);
  }, [targetEnv]);

  if (!targetEnv) return null;

  return (
    <div className="ov-backdrop">
      <div className="ov-card">
        <div className="ov-card-head">
          <span className="env-dot" style={{ background: targetEnv.color, width: 10, height: 10 }} />
          <div>
            <div style={{ fontSize: 'var(--tx-md)', fontWeight: 500 }}>
              Switching to <span style={{ color: targetEnv.color }}>{targetEnv.label}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{targetEnv.host}</div>
          </div>
          {targetEnv.danger && <span className="chip-danger" style={{ marginLeft: 'auto' }}>production</span>}
        </div>
        <div className="ov-card-body">
          <div style={{ fontSize: 'var(--tx-sm)', color: 'var(--tx-2)', marginBottom: 10 }}>
            Validating connections to {DATABASES.length} databases…
          </div>
          <div className="ov-list">
            {DATABASES.map((db, i) => {
              const s = i < stage ? 'ok' : i === stage ? 'running' : 'idle';
              return (
                <div key={db.name} className="ov-item">
                  <span style={{ width: 16 }}>
                    {s === 'ok' && <span style={{ color: 'var(--ok)' }}>{I.check(14)}</span>}
                    {s === 'running' && <span style={{ color: 'var(--acc)' }}>{I.spinner(14)}</span>}
                    {s === 'idle' && <span className="dot idle" />}
                  </span>
                  <span className="mono" style={{ flex: 1, color: s === 'idle' ? 'var(--tx-4)' : 'var(--tx-1)' }}>{db.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-4)' }}>
                    {s === 'ok' ? `${40 + i * 18}ms` : s === 'running' ? 'checking…' : 'queued'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="ov-card-foot">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <span style={{ color: 'var(--tx-4)', fontSize: 11 }}>{stage === DATABASES.length ? 'All connections healthy' : ''}</span>
        </div>
      </div>
      <style>{`
        .ov-backdrop {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200;
          animation: fade-in 140ms ease-out;
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .ov-card {
          width: 440px; background: var(--bg-2);
          border: 1px solid var(--line-2); border-radius: var(--r-xl);
          box-shadow: var(--shadow-overlay); overflow: hidden;
        }
        .ov-card-head {
          display: flex; gap: 10px; align-items: center;
          padding: 14px 16px 12px; border-bottom: 1px solid var(--line-1);
        }
        .ov-card-body { padding: 14px 16px; }
        .ov-card-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 10px 16px; background: var(--bg-1); border-top: 1px solid var(--line-1);
        }
        .ov-list { display: flex; flex-direction: column; gap: 2px; }
        .ov-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: var(--r-sm);
          font-size: var(--tx-sm);
        }
      `}</style>
    </div>
  );
}

function CommandPalette({ onClose }) {
  const items = [
    { kind: 'action', icon: I.play(12), name: 'Run query', hint: '⌘↵' },
    { kind: 'action', icon: I.code(12), name: 'New query tab', hint: '⌘T' },
    { kind: 'action', icon: I.history(12), name: 'Query history', hint: '⌘H' },
    { kind: 'action', icon: I.download(12), name: 'Export results as CSV', hint: '⌘E' },
    { kind: 'env', icon: I.db(12), name: 'Switch environment → production', danger: true },
    { kind: 'table', icon: I.table(12), name: 'ledger.transactions', hint: '48.2M rows' },
    { kind: 'table', icon: I.table(12), name: 'on_boarding.customers', hint: '1.3M rows' },
    { kind: 'table', icon: I.table(12), name: 'account_management.accounts', hint: '1.28M rows' },
  ];
  return (
    <div className="ov-backdrop" onClick={onClose}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <div className="cmd-head">
          <span style={{ color: 'var(--tx-3)' }}>{I.search(14)}</span>
          <input autoFocus placeholder="Search tables, queries, actions…" />
          <span className="kbd">esc</span>
        </div>
        <div className="cmd-body">
          {items.map((it, i) => (
            <button key={i} className={`cmd-item ${i === 0 ? 'cmd-active' : ''}`}>
              <span style={{ color: it.kind === 'table' ? 'var(--sx-table)' : it.danger ? 'var(--env-prod)' : 'var(--tx-3)' }}>{it.icon}</span>
              <span className="cmd-name">{it.name}</span>
              <span className="cmd-kind">{it.kind}</span>
              {it.hint && <span className="kbd">{it.hint}</span>}
            </button>
          ))}
        </div>
        <style>{`
          .cmd {
            width: 560px; margin-top: 12vh;
            background: var(--bg-2); border: 1px solid var(--line-2); border-radius: var(--r-xl);
            box-shadow: var(--shadow-overlay); overflow: hidden; align-self: flex-start;
          }
          .cmd-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line-1); }
          .cmd-head input { flex: 1; background: none; border: 0; outline: 0; color: var(--tx-1); font-size: var(--tx-lg); }
          .cmd-head input::placeholder { color: var(--tx-4); }
          .cmd-body { max-height: 380px; overflow-y: auto; padding: 4px; }
          .cmd-item {
            display: flex; align-items: center; gap: 10px; width: 100%;
            padding: 7px 10px; border-radius: var(--r-md); text-align: left;
            color: var(--tx-2); font-size: var(--tx-sm);
          }
          .cmd-item:hover, .cmd-active { background: var(--bg-3); color: var(--tx-1); }
          .cmd-name { flex: 1; }
          .cmd-kind { font-size: 10.5px; color: var(--tx-4); text-transform: uppercase; letter-spacing: .06em; }
        `}</style>
      </div>
    </div>
  );
}

function TweaksPanel({ open, onClose, tweaks, setTweaks }) {
  if (!open) return null;
  const setT = (k, v) => setTweaks({ ...tweaks, [k]: v });
  return (
    <div className="tw-panel">
      <div className="tw-head">
        <span>Tweaks</span>
        <button className="sb-icon-btn" onClick={onClose}>{I.close(12)}</button>
      </div>
      <div className="tw-body">
        <TwGroup label="Demo state">
          <TwSegment value={tweaks.state} onChange={v => setT('state', v)} options={[
            ['empty','Empty'],['autocomplete','Autocomplete'],['running','Running'],
            ['results','Results'],['row-limit','Row limit'],['python','+ Python'],
            ['chart','+ Chart'],['error','Error'],['env-switch','Env switch'],
          ]} />
        </TwGroup>
        <TwGroup label="Theme">
          <TwSegment value={tweaks.theme} onChange={v => setT('theme', v)} options={[['dark','Dark'],['light','Light']]} />
        </TwGroup>
        {tweaks.theme === 'dark' && (
          <TwGroup label="Dark palette">
            <TwSegment value={tweaks.palette || 'default'} onChange={v => setT('palette', v)} options={[
              ['default','Default'],['material','Material'],['dracula','Dracula'],
              ['solarized','Solarized'],['github','GitHub'],['nightowl','Night Owl'],
            ]} />
          </TwGroup>
        )}
        <TwGroup label="Aesthetic">
          <TwSegment value={tweaks.aesthetic} onChange={v => setT('aesthetic', v)} options={[['sharp','Sharp (Linear)'],['soft','Soft (Warp)']]} />
        </TwGroup>
        <TwGroup label="Density">
          <TwSegment value={tweaks.density} onChange={v => setT('density', v)} options={[['compact','Compact'],['comfortable','Comfortable']]} />
        </TwGroup>
        <TwGroup label="Layout">
          <TwSegment value={tweaks.layout} onChange={v => setT('layout', v)} options={[['three','Schema + workspace'],['two','Workspace only']]} />
        </TwGroup>
        <TwGroup label="Accent">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['indigo','#7c5cff'],['emerald','#3ecf8e'],['amber','#f5a524'],['rose','#ff5c6c'],['sky','#4cc2ff']].map(([k, c]) => (
              <button key={k} onClick={() => setT('accent', k)} className="tw-swatch" style={{
                background: c, outline: tweaks.accent === k ? '2px solid var(--tx-1)' : '2px solid transparent', outlineOffset: 2,
              }} title={k} />
            ))}
          </div>
        </TwGroup>
      </div>
      <style>{`
        .tw-panel {
          position: fixed; right: 12px; top: 56px; bottom: 30px;
          width: 260px; z-index: 180;
          background: var(--bg-2); border: 1px solid var(--line-2);
          border-radius: var(--r-lg); box-shadow: var(--shadow-overlay);
          display: flex; flex-direction: column;
        }
        .tw-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--line-1);
          font-weight: 600; font-size: var(--tx-sm);
        }
        .tw-body { flex: 1; overflow-y: auto; padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 12px; }
        .tw-group { display: flex; flex-direction: column; gap: 6px; }
        .tw-group-label { font-size: var(--tx-xs); text-transform: uppercase; letter-spacing: .08em; color: var(--tx-3); font-weight: 600; }
        .tw-seg { display: flex; flex-wrap: wrap; gap: 4px; background: var(--bg-1); border: 1px solid var(--line-1); border-radius: var(--r-md); padding: 3px; }
        .tw-seg-opt {
          padding: 4px 8px; border-radius: calc(var(--r-md) - 2px);
          font-size: var(--tx-xs); color: var(--tx-2); flex: 1 0 auto; text-align: center;
          white-space: nowrap;
        }
        .tw-seg-opt:hover { color: var(--tx-1); }
        .tw-seg-opt-active { background: var(--bg-3); color: var(--tx-1); font-weight: 500; }
        .tw-swatch { width: 22px; height: 22px; border-radius: 999px; border: 0; }
      `}</style>
    </div>
  );
}

function TwGroup({ label, children }) {
  return <div className="tw-group"><div className="tw-group-label">{label}</div>{children}</div>;
}
function TwSegment({ value, onChange, options }) {
  return (
    <div className="tw-seg">
      {options.map(([v, lab]) => (
        <button key={v} className={`tw-seg-opt ${value === v ? 'tw-seg-opt-active' : ''}`} onClick={() => onChange(v)}>{lab}</button>
      ))}
    </div>
  );
}

Object.assign(window, { EnvValidateOverlay, CommandPalette, TweaksPanel });
