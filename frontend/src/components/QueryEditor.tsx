import { useCallback, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { Icons } from "./Icons";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_SQL = `-- Cross-DB query: use db_name.table notation
SELECT u.name, o.total, o.status
FROM users.users u
JOIN orders.orders o ON u.id = o.user_id
WHERE o.status = 'paid'
ORDER BY o.total DESC;`;

interface QueryEditorProps {
  onRun: (sql: string) => void;
}

export function QueryEditor({ onRun }: QueryEditorProps) {
  const { isQuerying, schema, theme } = useAppStore();
  const [value, setValue] = useState(DEFAULT_SQL);

  const handleRun = useCallback(() => {
    if (value.trim()) onRun(value);
  }, [value, onRun]);

  // Build autocomplete schema for CodeMirror
  const cmSchema: Record<string, string[]> = {};
  for (const [dbName, tables] of Object.entries(schema)) {
    for (const [tableName, cols] of Object.entries(tables)) {
      cmSchema[`${dbName}.${tableName}`] = cols;
    }
  }

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
          extensions={[
            sql({
              dialect: PostgreSQL,
              schema: cmSchema,
              upperCaseKeywords: true,
            }),
          ]}
          theme={theme === "dark" ? oneDark : undefined}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLineGutter: true,
            autocompletion: true,
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
