// topbar.jsx — top chrome: logo, env switcher, search, theme/tweaks
// relies on window.I, window.ENVIRONMENTS

const { useState, useRef, useEffect } = React;

function TopBar({
  envId, setEnvId, theme, setTheme, onOpenCmd, onOpenTweaks, queryTabs, activeTab, setActiveTab, addTab, closeTab,
}) {
  const env = ENVIRONMENTS.find(e => e.id === envId);
  const [envOpen, setEnvOpen] = useState(false);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="logo" aria-label="CrossQL">
          <span style={{ color: 'var(--acc)' }}>{I.logo(18)}</span>
          <span className="logo-text">CrossQL</span>
        </div>

        <EnvSwitcher env={env} open={envOpen} setOpen={setEnvOpen} onPick={(id) => { setEnvId(id); setEnvOpen(false); }} />

        <div className="tabs">
          {queryTabs.map((t, i) => (
            <div key={t.id} className={`tab ${i === activeTab ? 'tab-active' : ''}`} onClick={() => setActiveTab(i)}>
              <span className="tab-dot" style={{ background: t.dirty ? 'var(--warn)' : 'var(--tx-4)' }} />
              <span className="tab-label">{t.name}</span>
              {queryTabs.length > 1 && (
                <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(i); }} aria-label="close">
                  {I.close(10)}
                </button>
              )}
            </div>
          ))}
          <button className="tab-add" onClick={addTab} title="New query tab">{I.plus(12)}</button>
        </div>
      </div>

      <div className="topbar-right">
        <button className="search-btn" onClick={onOpenCmd}>
          {I.search(13)}
          <span>Search tables, queries…</span>
          <span className="kbd" style={{ marginLeft: 'auto' }}>⌘K</span>
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
          {theme === 'dark' ? I.sun(14) : I.moon(14)}
        </button>
        <button className="icon-btn" title="History">{I.history(14)}</button>
        <button className="icon-btn" onClick={onOpenTweaks} title="Settings">{I.settings(14)}</button>
      </div>

      <style>{`
        .topbar {
          height: 44px;
          display: flex; align-items: stretch;
          justify-content: space-between;
          padding: 0 10px 0 12px;
          background: var(--bg-1);
          border-bottom: 1px solid var(--line-1);
          gap: 10px;
          flex-shrink: 0;
        }
        .topbar-left, .topbar-right { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .topbar-left { flex: 1 1 0; min-width: 0; }

        .logo { display: flex; align-items: center; gap: 7px; padding-right: 10px; }
        .logo-text { font-weight: 600; letter-spacing: -.01em; font-size: 13.5px; color: var(--tx-1); }

        .tabs { display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; padding-left: 6px; border-left: 1px solid var(--line-1); height: 100%; margin-left: 2px; }
        .tab {
          display: flex; align-items: center; gap: 6px;
          padding: 0 8px 0 10px; height: 28px; margin-top: 8px;
          border-radius: var(--r-sm) var(--r-sm) 0 0;
          color: var(--tx-3);
          cursor: pointer; font-size: var(--tx-sm); max-width: 180px;
          border: 1px solid transparent; border-bottom: 0;
          position: relative;
        }
        .tab:hover { color: var(--tx-2); background: var(--bg-2); }
        .tab-active {
          color: var(--tx-1); background: var(--bg-0);
          border-color: var(--line-1);
          margin-bottom: -1px; height: 29px;
        }
        .tab-dot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
        .tab-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tab-close { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 3px; color: var(--tx-4); opacity: 0; }
        .tab:hover .tab-close, .tab-active .tab-close { opacity: 1; }
        .tab-close:hover { background: var(--bg-3); color: var(--tx-1); }
        .tab-add { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--r-sm); color: var(--tx-3); margin-left: 4px; }
        .tab-add:hover { background: var(--bg-2); color: var(--tx-1); }

        .search-btn {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-2);
          border: 1px solid var(--line-1);
          border-radius: var(--r-md);
          padding: 5px 8px 5px 10px;
          color: var(--tx-3); font-size: var(--tx-sm);
          min-width: 260px;
        }
        .search-btn:hover { background: var(--bg-3); border-color: var(--line-2); }
        .icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: var(--r-md);
          color: var(--tx-2);
        }
        .icon-btn:hover { background: var(--bg-3); color: var(--tx-1); }
      `}</style>
    </div>
  );
}

function EnvSwitcher({ env, open, setOpen, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [setOpen]);

  return (
    <div className="env" ref={ref}>
      <button className={`env-pill env-${env.id} ${env.danger ? 'env-danger' : ''}`} onClick={() => setOpen(!open)}>
        <span className="env-dot" style={{ background: env.color }} />
        <span className="env-label">{env.label}</span>
        <span className="env-host">· {env.host.split('.')[0]}</span>
        <span style={{ opacity: .6 }}>{I.chev(open ? 'up' : 'down')}</span>
      </button>

      {open && (
        <div className="env-menu">
          <div className="env-menu-head">Switch environment</div>
          {ENVIRONMENTS.map(e => (
            <button key={e.id} className="env-menu-item" onClick={() => onPick(e.id)}>
              <span className="env-dot" style={{ background: e.color }} />
              <span style={{ fontWeight: 500, color: 'var(--tx-1)' }}>{e.label}</span>
              {e.danger && <span className="chip-danger">production</span>}
              {e.id === env.id && <span style={{ marginLeft: 'auto', color: 'var(--ok)' }}>{I.check(12)}</span>}
              <div className="env-menu-sub">
                <span className="mono" style={{ color: 'var(--tx-3)' }}>{e.host}</span>
                <span style={{ color: 'var(--tx-4)' }}>· {e.user}@{e.region}</span>
              </div>
            </button>
          ))}
          <div className="env-menu-foot">
            Connections defined in <span className="mono" style={{ color: 'var(--tx-2)' }}>~/.crossql/connections.yaml</span>
          </div>
        </div>
      )}

      <style>{`
        .env { position: relative; }
        .env-pill {
          display: flex; align-items: center; gap: 7px;
          padding: 4px 8px 4px 9px; height: 28px;
          background: var(--bg-2);
          border: 1px solid var(--line-2);
          border-radius: 999px;
          color: var(--tx-1); font-size: var(--tx-sm); font-weight: 500;
        }
        .env-pill:hover { background: var(--bg-3); }
        .env-danger {
          background: color-mix(in oklch, var(--env-prod) 14%, var(--bg-2));
          border-color: color-mix(in oklch, var(--env-prod) 55%, var(--line-2));
          color: color-mix(in oklch, var(--env-prod) 80%, var(--tx-1));
        }
        .env-danger:hover {
          background: color-mix(in oklch, var(--env-prod) 20%, var(--bg-2));
        }
        .env-dot { width: 8px; height: 8px; border-radius: 999px; }
        .env-host { color: var(--tx-4); font-family: var(--font-mono); font-size: 11px; }
        .env-label { letter-spacing: .01em; }

        .env-menu {
          position: absolute; top: calc(100% + 6px); left: 0;
          width: 420px;
          background: var(--bg-2);
          border: 1px solid var(--line-2);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-overlay);
          padding: 6px;
          z-index: 120;
        }
        .env-menu-head {
          padding: 6px 8px 4px; font-size: var(--tx-xs); color: var(--tx-3); text-transform: uppercase; letter-spacing: .08em;
        }
        .env-menu-item {
          display: grid;
          grid-template-columns: auto auto auto 1fr;
          gap: 8px; align-items: center;
          width: 100%;
          padding: 8px 10px;
          border-radius: var(--r-md);
          text-align: left;
          color: var(--tx-2);
        }
        .env-menu-item:hover { background: var(--bg-3); }
        .env-menu-sub {
          grid-column: 1 / -1;
          display: flex; gap: 8px; align-items: center;
          padding-left: 16px; font-size: var(--tx-xs);
        }
        .chip-danger {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: .08em;
          padding: 1px 6px; border-radius: 3px;
          background: color-mix(in oklch, var(--env-prod) 18%, transparent);
          color: var(--env-prod);
          font-weight: 600;
        }
        .env-menu-foot {
          margin-top: 4px; padding: 8px 10px; border-top: 1px solid var(--line-1);
          font-size: var(--tx-xs); color: var(--tx-3);
        }
      `}</style>
    </div>
  );
}

window.TopBar = TopBar;
