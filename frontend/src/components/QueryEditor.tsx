import { useCallback, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  autocompletion,
  acceptCompletion,
} from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
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

/**
 * Parse SQL text to extract alias → (db, table) mappings.
 * Matches patterns like:
 *   FROM db.table alias
 *   FROM db.table AS alias
 *   JOIN db.table alias
 *   JOIN db.table AS alias
 */
function parseAliases(sqlText: string): Map<string, { db: string; table: string }> {
  const aliases = new Map<string, { db: string; table: string }>();
  // Match: FROM/JOIN db.table [AS] alias
  const re = /(?:FROM|JOIN)\s+(\w+)\.(\w+)\s+(?:AS\s+)?(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sqlText)) !== null) {
    const [, db, table, alias] = m;
    // Skip SQL keywords that might follow table refs
    const kw = new Set(["ON", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "GROUP", "ORDER", "LIMIT", "HAVING", "UNION", "SET"]);
    if (!kw.has(alias.toUpperCase())) {
      aliases.set(alias.toLowerCase(), { db: db.toLowerCase(), table: table.toLowerCase() });
    }
  }
  return aliases;
}

/** Build a custom autocomplete source that understands db.table, aliases, and columns */
function buildCompletionSource(schema: SchemaCache, sqlText: string) {
  const aliases = parseAliases(sqlText);

  // Build a case-insensitive lookup for schema
  const schemaLower: Record<string, Record<string, string[]>> = {};
  for (const [db, tables] of Object.entries(schema)) {
    schemaLower[db.toLowerCase()] = {};
    for (const [table, cols] of Object.entries(tables)) {
      schemaLower[db.toLowerCase()][table.toLowerCase()] = cols;
    }
  }

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const text = word.text;
    const parts = text.split(".");
    const options: { label: string; type: string; detail?: string; boost?: number }[] = [];

    if (parts.length === 1) {
      const prefix = parts[0].toLowerCase();

      // Suggest database names
      for (const dbName of Object.keys(schema)) {
        if (!prefix || dbName.toLowerCase().startsWith(prefix)) {
          options.push({ label: dbName, type: "keyword", detail: "database", boost: 3 });
        }
      }

      // Suggest known aliases
      for (const [alias, ref] of aliases) {
        if (!prefix || alias.startsWith(prefix)) {
          options.push({
            label: alias,
            type: "variable",
            detail: `alias → ${ref.db}.${ref.table}`,
            boost: 4,
          });
        }
      }

      // Suggest db.table for quick access
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

      // Suggest all column names globally (low priority)
      const seenCols = new Set<string>();
      for (const tables of Object.values(schema)) {
        for (const [tableName, cols] of Object.entries(tables)) {
          for (const col of cols) {
            if (!seenCols.has(col)) {
              seenCols.add(col);
              options.push({ label: col, type: "property", detail: `column · ${tableName}`, boost: 0 });
            }
          }
        }
      }
    } else if (parts.length === 2) {
      const first = parts[0].toLowerCase();

      // Check if first part is an alias
      const aliasRef = aliases.get(first);
      if (aliasRef) {
        const cols = schemaLower[aliasRef.db]?.[aliasRef.table];
        if (cols) {
          for (const col of cols) {
            options.push({
              label: col,
              type: "property",
              detail: `${aliasRef.db}.${aliasRef.table}`,
              boost: 3,
            });
          }
        }
      }

      // Check if first part is a database name → suggest tables
      const tables = schemaLower[first];
      if (tables) {
        for (const [tableName, cols] of Object.entries(tables)) {
          options.push({ label: tableName, type: "class", detail: `${cols.length} columns`, boost: 2 });
        }
      }
    } else if (parts.length === 3) {
      // db.table.column
      const dbName = parts[0].toLowerCase();
      const tableName = parts[1].toLowerCase();
      const cols = schemaLower[dbName]?.[tableName];
      if (cols) {
        for (const col of cols) {
          options.push({ label: col, type: "property", detail: `column in ${tableName}`, boost: 2 });
        }
      }
    }

    if (options.length === 0) return null;

    const from = parts.length > 1
      ? word.from + text.lastIndexOf(".") + 1
      : word.from;

    return { from, options, validFor: /^[\w]*$/ };
  };
}

export function QueryEditor({ onRun }: QueryEditorProps) {
  const { isQuerying, schema, theme } = useAppStore();
  const [value, setValue] = useState(DEFAULT_SQL);

  const handleRun = useCallback(() => {
    if (value.trim()) onRun(value);
  }, [value, onRun]);

  // Build CodeMirror extensions with alias-aware autocomplete + Tab to accept
  const extensions = useMemo(() => {
    const completionSource = buildCompletionSource(schema, value);
    return [
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      autocompletion({
        override: [completionSource],
        activateOnTyping: true,
        maxRenderedOptions: 20,
        defaultKeymap: false, // disable default Enter to accept
      }),
      // Tab accepts completion; Enter does NOT accept (inserts newline instead)
      keymap.of([{ key: "Tab", run: acceptCompletion }]),
    ];
  }, [schema, value]);

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
            autocompletion: false, // handled by our extensions
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
