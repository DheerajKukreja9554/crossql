import { useCallback, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { Icons } from "./Icons";
import { useAppStore } from "../store/useAppStore";
import type { SchemaCache } from "../api/client";

const DEFAULT_SQL = `-- Cross-DB query: use db_name.table notation
SELECT u.name, o.total, o.status
FROM users.users u
JOIN orders.orders o ON u.id = o.user_id
WHERE o.status = 'paid'
ORDER BY o.total DESC;`;

interface QueryEditorProps {
  onRun: (sql: string) => void;
}

/** Build a custom autocomplete source that suggests db names, tables, and columns */
function buildCompletionSource(schema: SchemaCache) {
  return (context: CompletionContext): CompletionResult | null => {
    // Match word characters and dots (for db.table.column patterns)
    const word = context.matchBefore(/[\w.]*/)
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const text = word.text;
    const parts = text.split(".");
    const options: { label: string; type: string; detail?: string; boost?: number }[] = [];

    if (parts.length === 1) {
      // Suggest database names
      for (const dbName of Object.keys(schema)) {
        options.push({
          label: dbName,
          type: "keyword",
          detail: "database",
          boost: 2,
        });
      }
      // Also suggest db.table for quick access
      for (const [dbName, tables] of Object.entries(schema)) {
        for (const tableName of Object.keys(tables)) {
          options.push({
            label: `${dbName}.${tableName}`,
            type: "class",
            detail: `table in ${dbName}`,
            boost: 1,
          });
        }
      }
    } else if (parts.length === 2) {
      const dbName = parts[0];
      const tables = schema[dbName];
      if (tables) {
        // Suggest table names for this database
        for (const [tableName, cols] of Object.entries(tables)) {
          options.push({
            label: tableName,
            type: "class",
            detail: `${cols.length} columns`,
            boost: 2,
          });
        }
      }
    } else if (parts.length === 3) {
      const dbName = parts[0];
      const tableName = parts[1];
      const cols = schema[dbName]?.[tableName];
      if (cols) {
        // Suggest column names for this table
        for (const col of cols) {
          options.push({
            label: col,
            type: "property",
            detail: `column in ${tableName}`,
            boost: 2,
          });
        }
      }
    }

    // Also add column names as global suggestions (for use after aliases)
    if (parts.length === 1) {
      const seenCols = new Set<string>();
      for (const tables of Object.values(schema)) {
        for (const [tableName, cols] of Object.entries(tables)) {
          for (const col of cols) {
            if (!seenCols.has(col)) {
              seenCols.add(col);
              options.push({
                label: col,
                type: "property",
                detail: `column in ${tableName}`,
                boost: 0,
              });
            }
          }
        }
      }
    }

    if (options.length === 0) return null;

    // For dotted completions, only replace after the last dot
    const from = parts.length > 1
      ? word.from + text.lastIndexOf(".") + 1
      : word.from;

    return {
      from,
      options,
      validFor: /^[\w]*$/,
    };
  };
}

export function QueryEditor({ onRun }: QueryEditorProps) {
  const { isQuerying, schema, theme } = useAppStore();
  const [value, setValue] = useState(DEFAULT_SQL);

  const handleRun = useCallback(() => {
    if (value.trim()) onRun(value);
  }, [value, onRun]);

  // Build CodeMirror extensions with autocomplete
  const extensions = useMemo(() => {
    const completionSource = buildCompletionSource(schema);
    return [
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      autocompletion({
        override: [completionSource],
        activateOnTyping: true,
        maxRenderedOptions: 20,
      }),
    ];
  }, [schema]);

  // Count referenced databases from the SQL
  const dbNames = Object.keys(schema);
  const referencedDbs = dbNames.filter((db) =>
    value.toLowerCase().includes(db.toLowerCase() + ".")
  );

  return (
    <div className="editor-wrap">
      <div className="editor-head">
        <div className="editor-head-left">
          <span style={{ color: "var(--tx-3)" }}>
            <Icons.code size={13} />
          </span>
          <span className="editor-head-title">SQL</span>
          {referencedDbs.length > 0 && (
            <span className="editor-head-sub">
              <span style={{ color: "var(--sx-db)" }}>
                {referencedDbs.length} database
                {referencedDbs.length !== 1 ? "s" : ""} referenced
              </span>
              <span style={{ color: "var(--tx-4)", marginLeft: 8 }}>
                ·{" "}
                {referencedDbs.map((db, i) => (
                  <span key={db}>
                    {i > 0 && ", "}
                    <span style={{ color: "var(--sx-db)" }}>{db}</span>
                  </span>
                ))}
              </span>
            </span>
          )}
        </div>
        <div className="editor-head-right">
          <div className="vdiv" />
          {isQuerying ? (
            <button className="btn btn-danger" disabled>
              <Icons.stop size={10} /> Cancel
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleRun}>
              <Icons.play size={11} /> Run
              <span
                className="kbd"
                style={{
                  background: "rgba(255,255,255,.12)",
                  border: "none",
                  color: "rgba(255,255,255,.8)",
                }}
              >
                ⌘↵
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="editor-body">
        <CodeMirror
          value={value}
          onChange={setValue}
          extensions={extensions}
          theme={theme === "dark" ? oneDark : undefined}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLineGutter: true,
            autocompletion: false, // we handle it via extensions
          }}
          style={{
            height: "100%",
            fontSize: "12.5px",
            fontFamily: "var(--font-mono)",
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            }
          }}
        />
      </div>
    </div>
  );
}
