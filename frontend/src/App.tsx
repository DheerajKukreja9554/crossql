import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { QueryEditor } from "./components/QueryEditor";
import { ResultsPanel } from "./components/ResultsPanel";
import { PythonCell } from "./components/PythonCell";
import { StatusBar } from "./components/StatusBar";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const {
    loadEnvironments,
    runQuery,
    environments,
    activeEnv,
    activeHost,
    dbStatus,
    schema,
    switchEnv,
    reloadConfig,
    theme,
    setTheme,
    queryResult,
    queryError,
    isQuerying,
  } = useAppStore();

  // Apply initial theme on mount
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.palette = useAppStore.getState().palette;
  }, [theme]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleInsertRef = (ref: string) => {
    // Could integrate with CodeMirror cursor position in the future
    console.log("Insert reference:", ref);
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
      />

      <div className="app-body">
        <Sidebar
          schema={schema}
          dbStatus={dbStatus}
          activeHost={activeHost}
          activeEnv={activeEnv}
          onInsertRef={handleInsertRef}
          onReloadConfig={reloadConfig}
        />

        <div className="workspace">
          <div className="ws-sql">
            <QueryEditor onRun={runQuery} />
          </div>
          <div className="ws-split" />
          <div className="ws-results">
            <ResultsPanel
              queryResult={queryResult}
              queryError={queryError}
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
