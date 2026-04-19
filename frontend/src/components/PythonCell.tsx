import { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Icons } from "./Icons";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_PYTHON = `# df = merged result. Per-DB frames: df_<db_name>
import pandas as pd

print(df.describe())
`;

export function PythonCell() {
  const {
    runPython,
    pythonResult,
    isPythonRunning,
    queryResult,
    pythonOpen,
    setPythonOpen,
    theme,
    dbStatus,
  } = useAppStore();
  const [code, setCode] = useState(DEFAULT_PYTHON);

  const handleRun = useCallback(() => {
    if (code.trim()) runPython(code);
  }, [code, runPython]);

  const hasData = queryResult !== null;

  return (
    <div className="py-wrap">
      <div className="py-head">
        <div className="py-head-left">
          <button
            onClick={() => setPythonOpen(!pythonOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--tx-2)",
              cursor: "pointer",
              background: "none",
              border: "none",
            }}
          >
            <span
              style={{
                color: "var(--sx-db)",
                transform: pythonOpen ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
                display: "inline-flex",
              }}
            >
              <Icons.chevRight size={10} />
            </span>
            <span style={{ color: "var(--sx-db)" }}>
              <Icons.python size={13} />
            </span>
            <span className="editor-head-title">Python cell</span>
          </button>
          {hasData && (
            <span className="editor-head-sub">
              <span className="mono" style={{ color: "var(--sx-db)" }}>
                df
              </span>
              {Object.keys(dbStatus)
                .filter((db) => dbStatus[db] === "ok")
                .map((db) => (
                  <span key={db}>
                    <span style={{ color: "var(--tx-4)" }}> · </span>
                    <span className="mono" style={{ color: "var(--sx-db)" }}>
                      df_{db}
                    </span>
                  </span>
                ))}
            </span>
          )}
        </div>
        <div className="py-head-right">
          <span className="py-meta">sandboxed · 30s timeout</span>
          {pythonOpen && (
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={isPythonRunning || !hasData}
              style={{ padding: "4px 10px", fontSize: "var(--tx-sm)" }}
            >
              {isPythonRunning ? (
                <Icons.spinner size={10} />
              ) : (
                <Icons.play size={10} />
              )}
              Run
              <span
                className="kbd"
                style={{
                  background: "rgba(255,255,255,.12)",
                  border: "none",
                  color: "rgba(255,255,255,.8)",
                }}
              >
                ⇧↵
              </span>
            </button>
          )}
        </div>
      </div>

      {pythonOpen && (
        <div className="py-body">
          <div style={{ borderBottom: "1px solid var(--line-1)" }}>
            <CodeMirror
              value={code}
              onChange={setCode}
              extensions={[python()]}
              theme={theme === "dark" ? oneDark : undefined}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLineGutter: true,
              }}
              style={{
                fontSize: "12.5px",
                fontFamily: "var(--font-mono)",
              }}
              onKeyDown={(e) => {
                if (
                  (e.metaKey || e.ctrlKey) &&
                  e.shiftKey &&
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  handleRun();
                }
              }}
            />
          </div>

          {pythonResult && (
            <div className="py-out">
              <div className="py-out-head">
                <span className="mono" style={{ color: "var(--tx-4)" }}>
                  Output:
                </span>
                {pythonResult.error && (
                  <span style={{ color: "var(--err)" }}>Error</span>
                )}
              </div>
              {pythonResult.error ? (
                <div className="py-output-error">{pythonResult.error}</div>
              ) : (
                <div className="py-output-text">{pythonResult.output}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
