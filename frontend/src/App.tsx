import { useEffect, useState } from "react";
import { TopBar } from "./components/TopBar";
import { ManageConnectionsModal } from "./components/ManageConnectionsModal";
import { Sidebar } from "./components/Sidebar";
import { QueryEditor } from "./components/QueryEditor";
import { ResultsPanel } from "./components/ResultsPanel";
import { PythonCell } from "./components/PythonCell";
import { StatusBar } from "./components/StatusBar";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const store = useAppStore();
  const {
    loadEnvironments,
    environments,
    activeEnv,
    activeHost,
    dbStatus,
    schema,
    switchEnv,
    reloadConfig,
    theme,
    setTheme,
    // Tabs
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    updateTabSql,
    renameTab,
    queryResults,
    queryErrors,
    queryingTabs,
    runQuery,
    // Saved queries + history
    savedQueries,
    history,
    deleteSavedQuery,
    updateSavedQuery,
    openQueryInTab,
    saveQuery,
  } = store;

  const [manageConnectionsOpen, setManageConnectionsOpen] = useState(false);
  const [closeConfirmTab, setCloseConfirmTab] = useState<{ id: string; name: string; sql: string } | null>(null);
  // Save dialog: { sql, tabName, onSaved? (called after save completes) }
  const [saveDialog, setSaveDialog] = useState<{ sql: string; tabName: string; onSaved?: () => void } | null>(null);
  const [saveDialogName, setSaveDialogName] = useState("");
  const [saveDialogSaving, setSaveDialogSaving] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeQueryResult = queryResults[activeTabId] ?? null;
  const activeQueryError = queryErrors[activeTabId] ?? null;
  const isQuerying = queryingTabs[activeTabId] ?? false;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.palette = useAppStore.getState().palette;
  }, [theme]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleRunQuery = (sql: string) => {
    runQuery(sql);
  };

  const handleCloseTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.dirty && tab.sql.trim()) {
      setCloseConfirmTab({ id: tab.id, name: tab.name, sql: tab.sql });
      return;
    }
    closeTab(tabId);
  };

  const openSaveDialog = (sql: string, tabName: string, onSaved?: () => void) => {
    setSaveDialogName(tabName.replace(".sql", ""));
    setSaveDialog({ sql, tabName, onSaved });
    setSaveDialogSaving(false);
  };

  const handleSaveAndClose = (tab: { id: string; name: string; sql: string }) => {
    openSaveDialog(tab.sql, tab.name, () => { closeTab(tab.id); setCloseConfirmTab(null); });
  };

  const handleSaveQuery = (sql: string) => {
    openSaveDialog(sql, activeTab?.name ?? "query");
  };

  const handleSaveDialogConfirm = () => {
    if (!saveDialog || !saveDialogName.trim()) return;
    setSaveDialogSaving(true);
    saveQuery(saveDialogName.trim(), saveDialog.sql)
      .then(() => { saveDialog.onSaved?.(); setSaveDialog(null); })
      .catch(console.error)
      .finally(() => setSaveDialogSaving(false));
  };

  const handleInsertRef = (ref: string) => {
    if (activeTab) {
      const newSql = activeTab.sql + (activeTab.sql.endsWith("\n") || activeTab.sql === "" ? "" : " ") + ref;
      updateTabSql(activeTabId, newSql);
    }
  };

  return (
    <div className="app">
      <TopBar
        envId={activeEnv}
        environments={environments}
        activeHost={activeHost}
        onSwitchEnv={switchEnv}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onReloadConfig={reloadConfig}
        tabs={tabs}
        activeTabId={activeTabId}
        onSetActiveTab={setActiveTab}
        onAddTab={addTab}
        onCloseTab={handleCloseTab}
        onRenameTab={renameTab}
        onManageConnections={() => setManageConnectionsOpen(true)}
      />

      <div className="app-body">
        <Sidebar
          schema={schema}
          dbStatus={dbStatus}
          activeHost={activeHost}
          activeEnv={activeEnv}
          savedQueries={savedQueries}
          history={history}
          onInsertRef={handleInsertRef}
          onReloadConfig={reloadConfig}
          onOpenQuery={openQueryInTab}
          onDeleteQuery={deleteSavedQuery}
          onRenameQuery={(id, name) => updateSavedQuery(id, { name })}
        />

        <div className="workspace">
          <div className="ws-sql">
            <QueryEditor
              tabId={activeTabId}
              sql={activeTab?.sql ?? ""}
              onSqlChange={(sql) => updateTabSql(activeTabId, sql)}
              onRun={handleRunQuery}
              onSave={handleSaveQuery}
              isQuerying={isQuerying}
            />
          </div>
          <div className="ws-split" />
          <div className="ws-results">
            <ResultsPanel
              queryResult={activeQueryResult}
              queryError={activeQueryError}
              isQuerying={isQuerying}
            />
          </div>
          <div className="ws-split" />
          <div className="ws-python">
            <PythonCell />
          </div>
        </div>
      </div>

      <StatusBar />

      {manageConnectionsOpen && (
        <ManageConnectionsModal onClose={() => setManageConnectionsOpen(false)} />
      )}

      {closeConfirmTab && !saveDialog && (
        <div className="modal-overlay" onClick={() => setCloseConfirmTab(null)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Unsaved changes</div>
                <div className="modal-subtitle">"{closeConfirmTab.name}" has unsaved content.</div>
              </div>
            </div>
            <div className="modal-body" style={{ padding: "14px 20px", fontSize: 13, color: "var(--tx-2)" }}>
              Do you want to save this query before closing?
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCloseConfirmTab(null)}>Cancel</button>
              <div className="modal-footer-right">
                <button className="btn btn-ghost" onClick={() => { closeTab(closeConfirmTab.id); setCloseConfirmTab(null); }}>
                  Discard
                </button>
                <button className="btn btn-primary" onClick={() => handleSaveAndClose(closeConfirmTab)}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saveDialog && (
        <div className="modal-overlay" onClick={() => setSaveDialog(null)}>
          <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Save query</div>
                <div className="modal-subtitle">Saves to the Queries panel in the sidebar</div>
              </div>
              <button className="modal-close" onClick={() => setSaveDialog(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: "14px 20px" }}>
              <div className="conn-field">
                <div className="conn-field-label">Name</div>
                <input
                  className="conn-input"
                  autoFocus
                  value={saveDialogName}
                  onChange={e => setSaveDialogName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveDialogConfirm(); if (e.key === "Escape") setSaveDialog(null); }}
                  placeholder="My query"
                />
              </div>
            </div>
            <div className="modal-footer">
              <div />
              <div className="modal-footer-right">
                <button className="btn btn-ghost" onClick={() => setSaveDialog(null)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveDialogConfirm}
                  disabled={!saveDialogName.trim() || saveDialogSaving}
                  style={{ opacity: !saveDialogName.trim() ? .5 : 1 }}
                >
                  {saveDialogSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
