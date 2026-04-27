import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
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

  const handleSaveQuery = (sql: string) => {
    const name = prompt("Save query as:", activeTab?.name ?? "My Query");
    if (name?.trim()) {
      saveQuery(name.trim(), sql).catch(console.error);
    }
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
        onCloseTab={closeTab}
        onRenameTab={renameTab}
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
    </div>
  );
}
