import { useEffect, useRef, useState } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAppStore } from "../store/useAppStore";

export function PythonCell() {
  const { runPython, queryResult, pythonResult, isPythonRunning } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const codeRef = useRef<string>("print(df.head())\nprint(df.describe())");

  const handleRun = () => {
    if (!isPythonRunning && codeRef.current.trim()) {
      runPython(codeRef.current);
    }
  };

  useEffect(() => {
    if (!isOpen || !editorRef.current || viewRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: codeRef.current,
        extensions: [
          history(),
          python(),
          oneDark,
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            {
              key: "Mod-Enter",
              run: () => { handleRun(); return true; },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              codeRef.current = update.state.doc.toString();
            }
          }),
          EditorView.theme({
            "&": { height: "150px", fontSize: "13px" },
            ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
          }),
        ],
      }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isOpen]);

  const disabled = !queryResult;

  return (
    <div className={`python-cell ${isOpen ? "python-cell--open" : ""}`}>
      <button
        className="python-cell__toggle"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? "Run a SQL query first" : undefined}
      >
        <span className="python-cell__arrow">{isOpen ? "▼" : "▶"}</span>
        Python Analysis
        {disabled && <span className="python-cell__hint"> (run a query first)</span>}
      </button>

      {isOpen && (
        <div className="python-cell__body">
          <div className="python-cell__editor-wrap">
            <div ref={editorRef} />
          </div>
          <div className="python-cell__controls">
            <button
              className="run-button run-button--small"
              onClick={handleRun}
              disabled={isPythonRunning}
            >
              {isPythonRunning ? "Running..." : "▶ Run"}
            </button>
            <span className="python-cell__vars-hint">
              Available: <code>df</code>
              {Object.keys(useAppStore.getState().queryResult?.rows[0] ?? {}).length > 0 && ", "}
              {/* df_{db_name} vars available too */}
            </span>
          </div>

          {pythonResult && (
            <div className="python-output">
              {pythonResult.error ? (
                <pre className="python-output__error">{pythonResult.error}</pre>
              ) : (
                <pre className="python-output__stdout">{pythonResult.output || "(no output)"}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
