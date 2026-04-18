import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function ResultsTable() {
  const { queryResult, isQuerying, queryError } = useAppStore();
  const [sorting, setSorting] = useState<SortingState>([]);

  if (isQuerying) {
    return <div className="results-placeholder">Running query...</div>;
  }

  if (!queryResult && !queryError) {
    return (
      <div className="results-placeholder">
        Run a query to see results here.
      </div>
    );
  }

  if (!queryResult) return null;

  const { rows, columns, row_count, timing, warning } = queryResult;

  // Build column definitions dynamically
  const columnHelper = createColumnHelper<Record<string, unknown>>();
  const tableCols = columns.map((col) =>
    columnHelper.accessor((row) => row[col], {
      id: col,
      header: col,
      cell: (info) => {
        const val = info.getValue();
        if (val === null || val === undefined) return <span className="null-value">NULL</span>;
        return String(val);
      },
    })
  );

  return <TableInner rows={rows} cols={tableCols} rowCount={row_count} timing={timing} warning={warning} sorting={sorting} onSortingChange={setSorting} />;
}

interface TableInnerProps {
  rows: Record<string, unknown>[];
  cols: ReturnType<ReturnType<typeof createColumnHelper<Record<string, unknown>>>["accessor"]>[];
  rowCount: number;
  timing: { total_ms: number; per_db: Record<string, number>; duckdb_ms: number };
  warning?: string;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
}

function TableInner({ rows, cols, rowCount, timing, warning, sorting, onSortingChange }: TableInnerProps) {
  const table = useReactTable({
    data: rows,
    columns: cols,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const timingParts = Object.entries(timing.per_db)
    .map(([db, ms]) => `${db}: ${Math.round(ms)}ms`)
    .join(" · ");

  return (
    <div className="results-table">
      <div className="results-header">
        <span className="results-row-count">{rowCount.toLocaleString()} rows</span>
        <span className="results-timing">{timingParts}{timing.duckdb_ms > 0 ? ` · DuckDB: ${Math.round(timing.duckdb_ms)}ms` : ""}</span>
      </div>

      {warning && (
        <div className="results-warning">
          ⚠ {warning}
        </div>
      )}

      <div className="results-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? "sortable" : ""}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
