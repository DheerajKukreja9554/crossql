// app.jsx — main orchestrator

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "state": "results",
  "theme": "dark",
  "palette": "default",
  "aesthetic": "sharp",
  "density": "compact",
  "layout": "three",
  "accent": "indigo"
}/*EDITMODE-END*/;

const ACCENTS = {
  indigo: { dark: '#7c5cff', light: '#5b3df5' },
  emerald: { dark: '#3ecf8e', light: '#18a366' },
  amber: { dark: '#f5a524', light: '#c97a04' },
  rose: { dark: '#ff5c6c', light: '#d53343' },
  sky: { dark: '#4cc2ff', light: '#1f8acb' },
};

function App() {
  // load persisted tweaks
  const [tweaks, setTweaks] = useStateA(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('crossql-tweaks') || 'null');
      return { ...TWEAK_DEFAULTS, ...(saved || {}) };
    } catch { return TWEAK_DEFAULTS; }
  });
  useEffectA(() => {
    localStorage.setItem('crossql-tweaks', JSON.stringify(tweaks));
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: tweaks }, '*');
    } catch {}
  }, [tweaks]);

  const [envId, setEnvId] = useStateA('sandbox');
  const [pendingEnv, setPendingEnv] = useStateA(null);
  const [cmdOpen, setCmdOpen] = useStateA(false);
  const [tweaksOpen, setTweaksOpen] = useStateA(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useStateA(false);
  const [queryTabs, setQueryTabs] = useStateA([
    { id: 1, name: 'txn_by_risk_tier.sql', dirty: true, value: DEFAULT_QUERY },
    { id: 2, name: 'kyc_mismatch.sql', dirty: false, value: '-- WIP: compare kyc_status across services\nSELECT ...' },
  ]);
  const [activeTab, setActiveTab] = useStateA(0);
  const [connectOpen, setConnectOpen] = useStateA(false);
  const [capEditDb, setCapEditDb] = useStateA(null);
  const [dbCaps, setDbCaps] = useStateA({
    account_management: 50000, on_boarding: 50000, cards: 50000, ledger: 200000, rewards: 50000,
  });

  const updateActiveValue = (v) => setQueryTabs(qs => qs.map((q, i) => i === activeTab ? { ...q, value: v, dirty: true } : q));
  const addTab = () => setQueryTabs(qs => [...qs, { id: Date.now(), name: `query_${qs.length + 1}.sql`, dirty: false, value: '-- new query\n' }]);
  const closeTab = (i) => setQueryTabs(qs => {
    const next = qs.filter((_, j) => j !== i);
    if (activeTab >= next.length) setActiveTab(Math.max(0, next.length - 1));
    return next;
  });

  // Tweaks / edit-mode host protocol
  useEffectA(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || !d.type) return;
      if (d.type === '__activate_edit_mode') setTweaksOpen(true);
      if (d.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // keyboard
  useEffectA(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(v => !v); }
      if (e.key === 'Escape') { setCmdOpen(false); setPendingEnv(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Apply theme/aesthetic/density/accent to root
  useEffectA(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.palette = tweaks.palette || 'default';
    root.dataset.aesthetic = tweaks.aesthetic;
    root.dataset.density = tweaks.density;
    const acc = ACCENTS[tweaks.accent] || ACCENTS.indigo;
    root.style.setProperty('--acc', acc[tweaks.theme] || acc.dark);
  }, [tweaks.theme, tweaks.palette, tweaks.aesthetic, tweaks.density, tweaks.accent]);

  // Demo state → controls what shows where
  const demo = tweaks.state;
  const editorState = {
    running: demo === 'running',
    autocomplete: demo === 'autocomplete',
    error: demo === 'error' ? { line: 4, col: 5, len: 6 } : null,
  };
  const resultsState =
    demo === 'empty' || demo === 'autocomplete' ? 'empty' :
    demo === 'running' ? 'running' :
    demo === 'error' ? 'error' :
    demo === 'row-limit' ? 'row-limit' :
    'results';
  const showPython = demo === 'python' || demo === 'chart';
  const pythonState = demo === 'chart' ? 'chart' : 'output';

  // Env switch handling
  const triggerEnvSwitch = (id) => {
    if (id === envId) return;
    setPendingEnv(ENVIRONMENTS.find(e => e.id === id));
  };
  const finishEnvSwitch = () => {
    if (pendingEnv) setEnvId(pendingEnv.id);
    setPendingEnv(null);
  };

  // Wrap TopBar's setEnvId to go through validation
  const topSetEnv = (id) => { triggerEnvSwitch(id); };

  // Insert reference from sidebar
  const onInsertRef = (ref) => {
    setQueryTabs(qs => qs.map((q, i) => i === activeTab ? { ...q, value: q.value + (q.value.endsWith('\n') ? '' : ' ') + ref, dirty: true } : q));
  };

  const activeQuery = queryTabs[activeTab]?.value || '';
  const setActiveQuery = updateActiveValue;

  const running = editorState.running;

  // Split sizes (vertical split between SQL + (Results/Python))
  const showEnvOverlay = demo === 'env-switch';

  return (
    <div className="app">
      <TopBar
        envId={envId}
        setEnvId={topSetEnv}
        theme={tweaks.theme}
        setTheme={(t) => setTweaks({ ...tweaks, theme: t })}
        onOpenCmd={() => setCmdOpen(true)}
        onOpenTweaks={() => setTweaksOpen(v => !v)}
        queryTabs={queryTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        addTab={addTab}
        closeTab={closeTab}
      />

      <div className="app-body">
        {tweaks.layout === 'three' && (
          <Sidebar
            env={ENVIRONMENTS.find(e => e.id === envId)}
            onInsertRef={onInsertRef}
            collapsed={sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
            onConnectServer={() => setConnectOpen(true)}
            dbCaps={dbCaps}
            onEditCap={(name) => setCapEditDb(name)}
          />
        )}

        <div className="workspace">
          <div className="ws-sql">
            <SqlEditor
              value={activeQuery}
              onChange={setActiveQuery}
              onRun={() => setTweaks({ ...tweaks, state: 'running' })}
              onCancel={() => setTweaks({ ...tweaks, state: 'results' })}
              running={running}
              autocompleteOpen={editorState.autocomplete}
              error={editorState.error}
              onInsertSuggestion={(name) => setActiveQuery(activeQuery + name)}
            />
          </div>
          <div className="ws-split" />
          <div className="ws-results">
            <ResultsPanel state={resultsState} onPromote={() => {}} />
          </div>
          {showPython && (
            <>
              <div className="ws-split" />
              <div className="ws-python">
                <PythonCell state={pythonState} />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar envId={envId} demo={demo} />

      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} tweaks={tweaks} setTweaks={setTweaks} />

      {connectOpen && <ConnectServerModal onClose={() => setConnectOpen(false)} onConnected={() => setConnectOpen(false)} />}

      {capEditDb && (
        <CapPopover
          db={{ name: capEditDb, cap: dbCaps[capEditDb] ?? 50000 }}
          onClose={() => setCapEditDb(null)}
          onSave={(v) => setDbCaps({ ...dbCaps, [capEditDb]: v })}
        />
      )}

      {(pendingEnv || showEnvOverlay) && (
        <EnvValidateOverlay
          targetEnv={pendingEnv || ENVIRONMENTS.find(e => e.id === 'prod')}
          onDone={finishEnvSwitch}
          onCancel={() => { setPendingEnv(null); if (showEnvOverlay) setTweaks({ ...tweaks, state: 'results' }); }}
        />
      )}

      <style>{`
        .app { height: 100vh; width: 100vw; display: flex; flex-direction: column; overflow: hidden; }
        .app-body { flex: 1; display: flex; min-height: 0; }
        .workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .ws-sql { flex: 0 0 34%; min-height: 160px; display: flex; }
        .ws-results { flex: 1; min-height: 0; display: flex; }
        .ws-python { flex: 0 0 auto; max-height: 44%; display: flex; overflow: auto; border-top: 1px solid var(--line-1); }
        .ws-split { height: 1px; background: var(--line-1); flex-shrink: 0; }
      `}</style>
    </div>
  );
}

function StatusBar({ envId, demo }) {
  const env = ENVIRONMENTS.find(e => e.id === envId);
  return (
    <div className="statusbar">
      <div className="sb-left">
        <span className="dot ok" />
        <span>5 DBs healthy</span>
        <span className="sb-sep">·</span>
        <span style={{ color: env.color }}>{env.label}</span>
        <span className="sb-sep">·</span>
        <span className="mono">{env.host}</span>
      </div>
      <div className="sb-right">
        <span>DuckDB 0.10 · in-memory</span>
        <span className="sb-sep">·</span>
        <span>asyncpg · 3 parallel</span>
        <span className="sb-sep">·</span>
        <span>⌘K commands</span>
      </div>
      <style>{`
        .statusbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 12px; height: 22px;
          background: var(--bg-1); border-top: 1px solid var(--line-1);
          font-size: 11px; color: var(--tx-3);
          flex-shrink: 0;
        }
        .sb-left, .sb-right { display: flex; align-items: center; gap: 6px; }
        .sb-sep { color: var(--tx-4); }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
