import { useState, useMemo } from "react";
import { Icons } from "./Icons";
import type { QueryResult, AppError } from "../api/client";

interface ResultsPanelProps {
  queryResult: QueryResult | null;
  queryError: AppError | null;
  isQuerying: boolean;
}

export function ResultsPanel({ queryResult, queryError, isQuerying }: ResultsPanelProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!queryResult || !sortCol) return queryResult?.rows ?? [];
    const rows = [...queryResult.rows];
    rows.sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return rows;
  }, [queryResult, sortCol, sortDir]);

  const exportCsv = () => {
    if (!queryResult) return;
    const { columns, rows } = queryResult;
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [
      columns.join(","),
      ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Running state ────────────────────────────────────────────────────────────
  if (isQuerying) {
    return (
      <div className="results-wrap">
        <div className="results-head">
          <div className="results-head-left">
            <span className="editor-head-title">
              <Icons.table size={14} /> Results
            </span>
          </div>
        </div>
        <div className="running">
          <div className="running-title">
            <Icons.spinner size={16} /> Executing query...
          </div>
          <ul className="running-list">
            <li className="running-item">
              <span>Parsing &amp; planning</span>
              <div className="running-bar">
                <div className="running-bar-fill" style={{ width: "100%" }} />
              </div>
            </li>
            <li className="running-item">
              <span>Fetching from databases</span>
              <div className="running-bar">
                <div className="running-bar-fill" style={{ width: "60%", animationDelay: "0.2s" }} />
              </div>
            </li>
            <li className="running-item">
              <span>Merging in DuckDB</span>
              <div className="running-bar">
                <div className="running-bar-fill" style={{ width: "30%", animationDelay: "0.4s" }} />
              </div>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (queryError) {
    return (
      <div className="results-wrap">
        <div className="results-head">
          <div className="results-head-left">
            <span className="editor-head-title">
              <Icons.table size={14} /> Results
            </span>
          </div>
        </div>
        <div className="err-view">
          <div className="err-head">
            <Icons.errCircle size={18} />
            <div>
              <div className="err-title">{queryError.code.replace(/_/g, " ")}</div>
              <div className="err-sub">{queryError.error}</div>
            </div>
          </div>
          <pre className="err-msg">{queryError.detail}</pre>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!queryResult) {
    return (
      <div className="results-wrap">
        <div className="results-head">
          <div className="results-head-left">
            <span className="editor-head-title">
              <Icons.table size={14} /> Results
            </span>
          </div>
        </div>
        <div className="results-empty">
          <div className="empty-title">No results yet</div>
          <div className="empty-sub">
            Run a query to see results here.
          </div>
        </div>
      </div>
    );
  }

  // ── Results state ────────────────────────────────────────────────────────────
  const { columns, row_count, timing, warning } = queryResult;
  const maxDbMs = Math.max(...Object.values(timing.per_db), timing.duckdb_ms, 1);

  return (
    <div className="results-wrap">
      {/* Header */}
      <div className="results-head">
        <div className="results-head-left">
          <span className="editor-head-title">
            <Icons.table size={14} /> Results
          </span>
          <span className="result-meta">
            {row_count.toLocaleString("en-IN")} rows
            <span className="dot" />
            {timing.total_ms.toFixed(0)}ms
          </span>
        </div>
        <div className="results-head-right">
          <button className="btn-ghost" onClick={exportCsv} title="Export CSV">
            <Icons.download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Warning */}
      {warning && (
        <div className="result-meta" style={{ padding: "4px 12px", color: "var(--c-warn)" }}>
          <Icons.warn size={12} /> {warning}
        </div>
      )}

      {/* Subquery stats strip */}
      <div className="sq-strip">
        {Object.entries(timing.per_db).map(([db, ms]) => (
          <div className="sq-card" key={db}>
            <div className="sq-row">
              <span className="sq-name">{db}</span>
              <span className="sq-ms mono">{Math.round(ms)}ms</span>
            </div>
            <div className="sq-bar-outer">
              <div
                className="sq-bar-inner"
                style={{ width: `${(ms / maxDbMs) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {timing.duckdb_ms > 0 && (
          <div className="sq-card sq-duckdb">
            <div className="sq-row">
              <span className="sq-name">DuckDB merge</span>
              <span className="sq-ms mono">{Math.round(timing.duckdb_ms)}ms</span>
            </div>
            <div className="sq-bar-outer">
              <div
                className="sq-bar-inner"
                style={{ width: `${(timing.duckdb_ms / maxDbMs) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="results-table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th className="row-idx">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  {col}
                  {sortCol === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i}>
                <td className="row-idx">{i + 1}</td>
                {columns.map((col) => {
                  const val = row[col];
                  if (val === null || val === undefined) {
                    return (
                      <td key={col}>
                        <span className="null-value">null</span>
                      </td>
                    );
                  }
                  return <td key={col}>{String(val)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="res-foot">
        <span>
          Showing {sortedRows.length.toLocaleString("en-IN")} of{" "}
          {row_count.toLocaleString("en-IN")} rows
        </span>
        <span className="mono">{columns.length} columns</span>
      </div>
    </div>
  );
}
