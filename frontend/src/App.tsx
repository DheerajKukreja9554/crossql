import { useEffect } from "react";
import { EnvSwitcher } from "./components/EnvSwitcher";
import { QueryEditor } from "./components/QueryEditor";
import { ResultsTable } from "./components/ResultsTable";
import { PythonCell } from "./components/PythonCell";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const { loadEnvironments, runQuery } = useAppStore();

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <span className="topbar__title">DB Simplifier</span>
        <EnvSwitcher />
      </header>

      {/* Main content */}
      <main className="main">
        <QueryEditor onRun={runQuery} />
        <ResultsTable />
      </main>

      {/* Python cell — bottom panel */}
      <footer className="bottom-panel">
        <PythonCell />
      </footer>
    </div>
  );
}
