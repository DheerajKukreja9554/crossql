"""Parallel asyncpg execution + DuckDB in-memory merge.

Session store: module-level dict keyed by session UUID.
The Python sandbox reads from this store via session_id.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import duckdb
import pandas as pd

from connections import ConnectionManager
from query.parser import QueryPlan, SubQuery

logger = logging.getLogger(__name__)

# ── Row limit defaults ─────────────────────────────────────────────────────────
DEFAULT_ROW_LIMIT = 50_000
QUERY_TIMEOUT_SECONDS = 60


# ── Result types ───────────────────────────────────────────────────────────────

@dataclass
class SubQueryResult:
    db_name: str
    df: pd.DataFrame
    elapsed_ms: float
    duckdb_alias: str


@dataclass
class QueryResult:
    rows: list[dict[str, Any]]
    columns: list[str]
    row_count: int
    timing_per_db: dict[str, float]   # {db_name: elapsed_ms}
    duckdb_ms: float
    sub_results: dict[str, pd.DataFrame] = field(default_factory=dict)  # {db_name: df}
    merged_df: pd.DataFrame | None = None


class RowLimitError(Exception):
    def __init__(self, db_name: str, estimated: int, limit: int) -> None:
        self.db_name = db_name
        self.estimated = estimated
        self.limit = limit
        super().__init__(
            f"'{db_name}' sub-query estimates {estimated:,} rows (limit: {limit:,}). "
            f"Add a WHERE filter to reduce the result set."
        )


class QueryTimeoutError(Exception):
    pass


# ── Session store ──────────────────────────────────────────────────────────────
# Maps session_id → last QueryResult. Used by the Python sandbox.
session_store: dict[str, QueryResult] = {}


# ── Main entry point ───────────────────────────────────────────────────────────

async def execute_query(
    plan: QueryPlan,
    manager: ConnectionManager,
    session_id: str,
    row_limit: int = DEFAULT_ROW_LIMIT,
) -> QueryResult:
    """Execute a QueryPlan and return unified results.

    For single-DB queries, runs directly against PostgreSQL (skips DuckDB).
    For multi-DB queries, runs sub-queries in parallel and merges in DuckDB.

    Raises:
        RowLimitError: If any sub-query estimates more rows than row_limit.
        QueryTimeoutError: If execution exceeds QUERY_TIMEOUT_SECONDS.
    """
    try:
        return await asyncio.wait_for(
            _execute(plan, manager, session_id, row_limit),
            timeout=QUERY_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as e:
        raise QueryTimeoutError(f"Query exceeded {QUERY_TIMEOUT_SECONDS}s timeout") from e


async def _execute(
    plan: QueryPlan,
    manager: ConnectionManager,
    session_id: str,
    row_limit: int,
) -> QueryResult:
    if plan.is_single_db:
        return await _execute_single(plan, manager, session_id)

    # Multi-DB: check estimates, run in parallel, merge in DuckDB
    await _check_row_estimates(plan.sub_queries, manager, row_limit)

    t_start = time.monotonic()
    sub_results = await asyncio.gather(
        *[_run_sub_query(sq, manager) for sq in plan.sub_queries]
    )

    duckdb_t = time.monotonic()
    merged_df, result_rows, columns = _merge_in_duckdb(sub_results, plan.merge_sql)
    duckdb_ms = (time.monotonic() - duckdb_t) * 1000

    timing_per_db = {r.db_name: r.elapsed_ms for r in sub_results}
    total_ms = (time.monotonic() - t_start) * 1000

    result = QueryResult(
        rows=result_rows,
        columns=columns,
        row_count=len(result_rows),
        timing_per_db=timing_per_db,
        duckdb_ms=duckdb_ms,
        sub_results={r.db_name: r.df for r in sub_results},
        merged_df=merged_df,
    )
    session_store[session_id] = result
    logger.info(
        "Query complete: %d rows, %.0fms total (duckdb: %.0fms)",
        result.row_count, total_ms, duckdb_ms
    )
    return result


async def _execute_single(
    plan: QueryPlan,
    manager: ConnectionManager,
    session_id: str,
) -> QueryResult:
    """Run a single-DB query directly against PostgreSQL."""
    sq = plan.sub_queries[0]
    sub = await _run_sub_query(sq, manager)

    rows = sub.df.to_dict(orient="records")
    columns = list(sub.df.columns)

    result = QueryResult(
        rows=rows,
        columns=columns,
        row_count=len(rows),
        timing_per_db={sq.db_name: sub.elapsed_ms},
        duckdb_ms=0.0,
        sub_results={sq.db_name: sub.df},
        merged_df=sub.df,
    )
    session_store[session_id] = result
    return result


async def _run_sub_query(sq: SubQuery, manager: ConnectionManager) -> SubQueryResult:
    """Execute one sub-query against its PostgreSQL database."""
    pool = await manager.get_pool(sq.db_name)
    t = time.monotonic()
    async with pool.acquire() as conn:
        records = await conn.fetch(sq.sql)
    elapsed_ms = (time.monotonic() - t) * 1000

    df = pd.DataFrame([dict(r) for r in records]) if records else pd.DataFrame()
    return SubQueryResult(
        db_name=sq.db_name,
        df=df,
        elapsed_ms=elapsed_ms,
        duckdb_alias=sq.duckdb_alias,
    )


async def _check_row_estimates(
    sub_queries: list[SubQuery],
    manager: ConnectionManager,
    row_limit: int,
) -> None:
    """Run EXPLAIN on each sub-query and raise RowLimitError if any estimate exceeds limit."""
    estimates = await asyncio.gather(
        *[_estimate_rows(sq, manager) for sq in sub_queries]
    )
    for sq, estimate in zip(sub_queries, estimates):
        if estimate > row_limit:
            raise RowLimitError(sq.db_name, estimate, row_limit)


async def _estimate_rows(sq: SubQuery, manager: ConnectionManager) -> int:
    """Return PostgreSQL's row estimate for a sub-query via EXPLAIN."""
    pool = await manager.get_pool(sq.db_name)
    explain_sql = f"EXPLAIN (FORMAT JSON) {sq.sql}"
    try:
        async with pool.acquire() as conn:
            result = await conn.fetchval(explain_sql)
        plan = json.loads(result)
        return int(plan[0]["Plan"]["Plan Rows"])
    except Exception as e:
        logger.warning("EXPLAIN failed for %s, skipping estimate: %s", sq.db_name, e)
        return 0  # If EXPLAIN fails, don't block execution


def _merge_in_duckdb(
    sub_results: list[SubQueryResult],
    merge_sql: str,
) -> tuple[pd.DataFrame, list[dict], list[str]]:
    """Register sub-results in DuckDB and execute the merge SQL.

    Tables are registered by alias (not table name) to avoid name collisions.
    """
    conn = duckdb.connect()

    # Register each sub-result DataFrame as a DuckDB table using alias
    for sub in sub_results:
        if not sub.df.empty:
            # Each sub-query may cover multiple tables (their aliases are the table names
            # in the rewritten merge SQL). Register by the alias used in merge_sql.
            conn.register(sub.duckdb_alias, sub.df)
        else:
            # Register empty DataFrame to avoid "table not found" errors
            conn.register(sub.duckdb_alias, pd.DataFrame())

    try:
        result_df = conn.execute(merge_sql).df()
    finally:
        conn.close()

    rows = result_df.to_dict(orient="records")
    columns = list(result_df.columns)
    return result_df, rows, columns
