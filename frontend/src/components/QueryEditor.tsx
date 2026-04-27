import { useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  autocompletion,
  acceptCompletion,
  completionKeymap,
} from "@codemirror/autocomplete";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { keymap, EditorView } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { Icons } from "./Icons";
import { useAppStore } from "../store/useAppStore";
import type { SchemaCache } from "../api/client";
import { getStatementAtCursor } from "../lib/statementAtCursor";

interface QueryEditorProps {
  tabId: string;
  sql: string;
  onSqlChange: (sql: string) => void;
  onRun: (sql: string) => void;
  onSave?: (sql: string) => void;
  isQuerying: boolean;
}

// ── Alias parsing ────────────────────────────────────────────────────────────

function parseAliases(sqlText: string): Map<string, { db: string; table: string }> {
  const aliases = new Map<string, { db: string; table: string }>();
  const re = /(?:FROM|JOIN)\s+(\w+)\.(\w+)\s+(?:AS\s+)?(\w+)/gi;
  let m: RegExpExecArray | null;
  const kw = new Set(["ON", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "FULL", "CROSS", "GROUP", "ORDER", "LIMIT", "HAVING", "UNION", "SET"]);
  while ((m = re.exec(sqlText)) !== null) {
    const [, db, table, alias] = m;
    if (!kw.has(alias.toUpperCase())) {
      aliases.set(alias.toLowerCase(), { db: db.toLowerCase(), table: table.toLowerCase() });
    }
  }
  return aliases;
}

// ── SQL keyword completions ──────────────────────────────────────────────────

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN",
  "FULL OUTER JOIN", "CROSS JOIN", "ON", "GROUP BY", "ORDER BY", "HAVING",
  "LIMIT", "OFFSET", "DISTINCT", "AS", "AND", "OR", "NOT", "IN", "NOT IN",
  "EXISTS", "LIKE", "ILIKE", "BETWEEN", "IS NULL", "IS NOT NULL", "TRUE", "FALSE",
  "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "RETURNING",
  "WITH", "UNION", "UNION ALL", "EXCEPT", "INTERSECT",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
  "EXTRACT", "DATE_TRUNC", "NOW", "CURRENT_DATE", "CURRENT_TIMESTAMP",
  "STRING_AGG", "ARRAY_AGG", "JSON_AGG", "ROW_NUMBER", "RANK", "DENSE_RANK",
  "PARTITION BY", "OVER",
];

function buildKeywordCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  if (!context.explicit && word.text.length < 2) return null;
  const prefix = word.text.toUpperCase();
  const options = SQL_KEYWORDS
    .filter(k => k.startsWith(prefix))
    .map(k => ({ label: k, type: "keyword" as const, boost: -1 }));
  if (options.length === 0) return null;
  return { from: word.from, options };
}

// ── Autocomplete ─────────────────────────────────────────────────────────────

function buildCompletionSource(schema: SchemaCache, sqlRef: React.RefObject<string>) {
  const schemaLower: Record<string, Record<string, string[]>> = {};
  for (const [db, tables] of Object.entries(schema)) {
    schemaLower[db.toLowerCase()] = {};
    for (const [table, cols] of Object.entries(tables)) {
      schemaLower[db.toLowerCase()][table.toLowerCase()] = cols;
    }
  }

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || word.from === word.to) return null;
    // Require at least 2 chars when auto-triggered; Ctrl+Space always works
    if (!context.explicit && word.text.length < 2) return null;

    // Parse aliases from current SQL text (read from ref, not from dependency)
    const aliases = parseAliases(sqlRef.current ?? "");

    const text = word.text;
    const parts = text.split(".");
    const options: { label: string; type: string; detail?: string; boost?: number }[] = [];

    if (parts.length === 1) {
      const prefix = parts[0].toLowerCase();
      for (const dbName of Object.keys(schema)) {
        if (!prefix || dbName.toLowerCase().startsWith(prefix))
          options.push({ label: dbName, type: "keyword", detail: "database", boost: 3 });
      }
      for (const [alias, ref] of aliases) {
        if (!prefix || alias.startsWith(prefix))
          options.push({ label: alias, type: "variable", detail: `→ ${ref.db}.${ref.table}`, boost: 4 });
      }
      for (const [dbName, tables] of Object.entries(schema)) {
        for (const tableName of Object.keys(tables))
          options.push({ label: `${dbName}.${tableName}`, type: "class", detail: `table in ${dbName}`, boost: 1 });
      }
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
      const aliasRef = aliases.get(first);
      if (aliasRef) {
        const cols = schemaLower[aliasRef.db]?.[aliasRef.table];
        if (cols) for (const col of cols)
          options.push({ label: col, type: "property", detail: `${aliasRef.db}.${aliasRef.table}`, boost: 3 });
      }
      const tables = schemaLower[first];
      if (tables) for (const [tableName, cols] of Object.entries(tables))
        options.push({ label: tableName, type: "class", detail: `${cols.length} columns`, boost: 2 });
    } else if (parts.length === 3) {
      const cols = schemaLower[parts[0].toLowerCase()]?.[parts[1].toLowerCase()];
      if (cols) for (const col of cols)
        options.push({ label: col, type: "property", detail: `column in ${parts[1]}`, boost: 2 });
    }

    if (options.length === 0) return null;
    const from = parts.length > 1 ? word.from + text.lastIndexOf(".") + 1 : word.from;
    return { from, options, validFor: /^[\w]*$/ };
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function QueryEditor({ tabId, sql: value, onSqlChange, onRun, onSave, isQuerying }: QueryEditorProps) {
  const { schema, theme } = useAppStore();
  const sqlRef = useRef(value);
  sqlRef.current = value;
  const editorViewRef = useRef<EditorView | null>(null);

  const handleRun = useCallback(() => {
    if (!value.trim()) return;
    const view = editorViewRef.current;
    const cursorPos = view ? view.state.selection.main.head : undefined;
    const sel = view?.state.selection.main;
    const selectionText = (sel && !sel.empty)
      ? view!.state.sliceDoc(sel.from, sel.to)
      : undefined;
    const executed = getStatementAtCursor(value, cursorPos, selectionText);
    onRun(executed);
  }, [value, onRun]);

  const handleRunAll = useCallback(() => {
    if (value.trim()) onRun(value);
  }, [value, onRun]);

  // Extensions only depend on schema (not value!) — debounced autocomplete fix
  const extensions = useMemo(() => {
    const completionSource = buildCompletionSource(schema, sqlRef);
    const customCompletionKeymap = completionKeymap
      .filter((k) => k.key !== "Enter")
      .concat([{ key: "Tab", run: acceptCompletion }]);

    const selectionTheme = EditorView.theme({
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        background: "rgba(108,142,245,0.35)",
      },
      "&.cm-focused": { outline: "none" },
    });

    return [
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      selectionTheme,
      autocompletion({
        override: [completionSource, buildKeywordCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 20,
        defaultKeymap: false,
      }),
      Prec.highest(keymap.of(customCompletionKeymap)),
    ];
  }, [schema]); // NO dependency on value — fixed perf issue

  const dbNames = Object.keys(schema);
  const referencedDbs = dbNames.filter((db) =>
    value.toLowerCase().includes(db.toLowerCase() + ".")
  );

  return (
    <div className="editor-wrap">
      <div className="editor-head">
        <div className="editor-head-left">
          <span style={{ color: "var(--tx-3)" }}><Icons.code size={13} /></span>
          <span className="editor-head-title">SQL</span>
          {referencedDbs.length > 0 && (
            <span className="editor-head-sub">
              <span style={{ color: "var(--sx-db)" }}>
                {referencedDbs.length} DB{referencedDbs.length !== 1 ? "s" : ""}
              </span>
              <span style={{ color: "var(--tx-4)", marginLeft: 8 }}>
                · {referencedDbs.map((db, i) => (
                  <span key={db}>{i > 0 && ", "}<span style={{ color: "var(--sx-db)" }}>{db}</span></span>
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
            <>
              <button className="btn btn-primary" onClick={handleRun} title="Run statement at cursor (⌘↵)">
                <Icons.play size={11} /> Run
                <span className="kbd" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "rgba(255,255,255,.8)" }}>⌘↵</span>
              </button>
              <button className="btn-ghost" onClick={handleRunAll} title="Run all (⌘⇧↵)" style={{ fontSize: "var(--tx-xs)", color: "var(--tx-3)" }}>
                Run All
              </button>
              {onSave && value.trim() && (
                <button className="btn-ghost" onClick={() => onSave(value)} title="Save query" style={{ fontSize: "var(--tx-xs)", color: "var(--tx-3)" }}>
                  <Icons.bookmark size={11} /> Save
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="editor-body">
        <CodeMirror
          key={tabId}
          value={value}
          onChange={onSqlChange}
          extensions={extensions}
          theme={theme === "dark" ? oneDark : undefined}
          onCreateEditor={(view) => { editorViewRef.current = view; }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLineGutter: true,
            autocompletion: false,
          }}
          style={{ height: "100%", fontSize: "12.5px", fontFamily: "var(--font-mono)" }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
              e.preventDefault();
              handleRunAll();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault();
              if (onSave && value.trim()) onSave(value);
            }
          }}
        />
      </div>
    </div>
  );
}
