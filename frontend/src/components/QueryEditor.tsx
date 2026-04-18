import { useCallback, useEffect, useRef } from "react";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { autocompletion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAppStore } from "../store/useAppStore";
import { SchemaCache } from "../api/client";

function buildSqlCompletions(schema: SchemaCache) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const text = word.text;
    const options: { label: string; type: string }[] = [];

    if (text.includes(".")) {
      // db_name.table or db_name.table.column
      const parts = text.split(".");
      const dbName = parts[0];
      const tables = schema[dbName];
      if (tables) {
        if (parts.length === 2) {
          // Complete table names
          Object.keys(tables).forEach((tbl) =>
            options.push({ label: `${dbName}.${tbl}`, type: "class" })
          );
          // Complete columns if table known
          const tableName = parts[1];
          if (tables[tableName]) {
            tables[tableName].forEach((col) =>
              options.push({ label: `${dbName}.${tableName}.${col}`, type: "property" })
            );
          }
        }
      }
    } else {
      // Complete DB names
      Object.keys(schema).forEach((db) =>
        options.push({ label: db, type: "namespace" })
      );
    }

    return options.length > 0
      ? { from: word.from, options }
      : null;
  };
}

interface QueryEditorProps {
  onRun: (sql: string) => void;
}

export function QueryEditor({ onRun }: QueryEditorProps) {
  const { schema, isQuerying, queryError } = useAppStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sqlRef = useRef<string>("");

  const handleRun = useCallback(() => {
    if (!isQuerying && sqlRef.current.trim()) {
      onRun(sqlRef.current);
    }
  }, [isQuerying, onRun]);

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: "-- Write a cross-DB query using db_name.table notation\nSELECT u.name, o.total\nFROM users_db.users u\nJOIN orders_db.orders o ON u.id = o.user_id\nWHERE u.active = true\nORDER BY o.total DESC",
        extensions: [
          history(),
          sql({ dialect: PostgreSQL }),
          autocompletion({ override: [buildSqlCompletions(schema)] }),
          oneDark,
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            {
              key: "Mod-Enter",
              run: () => { handleRun(); return true; },
            },
          ]),
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              sqlRef.current = update.state.doc.toString();
            }
          }),
          EditorView.theme({
            "&": { height: "200px", fontSize: "14px" },
            ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, monospace" },
          }),
        ],
      }),
      parent: editorRef.current,
    });

    viewRef.current = view;
    sqlRef.current = view.state.doc.toString();

    return () => view.destroy();
  }, []); // Only mount once

  // Update autocomplete when schema changes
  useEffect(() => {
    if (!viewRef.current) return;
    // Reconfigure autocomplete with new schema
    viewRef.current.dispatch({
      effects: [],
    });
  }, [schema]);

  return (
    <div className="query-editor">
      <div className="query-editor__header">
        <span className="query-editor__label">SQL Query</span>
        <span className="query-editor__hint">Cmd+Enter to run</span>
      </div>
      <div ref={editorRef} className="query-editor__codemirror" />
      {queryError && (
        <div className="query-error">
          <strong>{queryError.code}:</strong> {queryError.error}
          {queryError.detail && <div className="query-error__detail">{queryError.detail}</div>}
        </div>
      )}
      <div className="query-editor__footer">
        <button
          className="run-button"
          onClick={handleRun}
          disabled={isQuerying}
        >
          {isQuerying ? "Running..." : "▶ Run"}
        </button>
      </div>
    </div>
  );
}
