"""Cross-DB SQL parser: sqlglot AST → QueryPlan with per-DB sub-queries and DuckDB merge SQL.

Notation: users use `db_name.table` (or `db_name.schema.table`) to reference tables
in different databases. sqlglot parses this as Table(db="db_name", name="table").

Design decisions:
- Tables registered in DuckDB by alias (not table name) to avoid name collisions
  when two DBs have a table with the same name.
- Predicate pushdown is scoped to simple WHERE conditions only (col op val).
  Cross-DB predicates and subqueries in WHERE stay in DuckDB.
- Single-DB queries skip DuckDB entirely — QueryPlan.is_single_db = True.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import sqlglot
import sqlglot.expressions as exp

logger = logging.getLogger(__name__)


class ParseError(Exception):
    """Raised when the SQL cannot be parsed or has invalid DB references."""


@dataclass
class SubQuery:
    """A rewritten sub-query targeting one PostgreSQL database."""

    db_name: str
    sql: str                       # rewritten SQL: no db_name. prefix, SELECT *, pushable predicates
    alias_to_table: dict[str, str] = field(default_factory=dict)  # alias → real table name
    duckdb_alias: str = ""         # name this result is registered as in DuckDB


@dataclass
class QueryPlan:
    """The full execution plan for a cross-DB query."""

    sub_queries: list[SubQuery]
    merge_sql: str              # original SQL with db_name. stripped (for DuckDB)
    referenced_dbs: set[str]
    is_single_db: bool = False  # if True, run merge_sql directly on the single DB


def parse_query(sql: str, known_dbs: set[str]) -> QueryPlan:
    """Parse a cross-DB SQL query into a QueryPlan.

    Args:
        sql: The SQL string written by the user (may reference multiple db_name.table).
        known_dbs: Set of DB names configured in the active environment.

    Returns:
        QueryPlan with sub-queries per DB and a DuckDB merge SQL.

    Raises:
        ParseError: On syntax error, unknown DB reference, or ambiguous table name.
    """
    try:
        ast = sqlglot.parse_one(sql, dialect="postgres")
    except sqlglot.errors.ParseError as e:
        raise ParseError(f"SQL syntax error: {e}") from e

    # ── Collect all table references ──────────────────────────────────────────
    # table_refs: list of (db_name | None, table_name, alias)
    table_refs: list[tuple[str | None, str, str]] = []
    for tbl in ast.find_all(exp.Table):
        db_name = tbl.db or None
        table_name = tbl.name
        alias = tbl.alias or table_name

        if db_name and db_name not in known_dbs:
            raise ParseError(
                f"Unknown database: '{db_name}'. Available: {sorted(known_dbs)}"
            )
        table_refs.append((db_name, table_name, alias))

    if not table_refs:
        raise ParseError("No table references found in query")

    # ── Check for ambiguous unqualified table names ───────────────────────────
    # If a table has no db_name. prefix, check if it's ambiguous across DBs.
    # We detect ambiguity conservatively: if two different DBs are referenced
    # AND an unqualified table name appears, we require qualification.
    referenced_dbs: set[str] = {db for db, _, _ in table_refs if db}
    unqualified = [(t, a) for db, t, a in table_refs if db is None]
    if referenced_dbs and unqualified:
        raise ParseError(
            f"Unqualified table(s) found with cross-DB query: "
            f"{[t for t, _ in unqualified]}. "
            f"Qualify all tables with their database name, e.g. db_name.{unqualified[0][0]}"
        )

    # ── Single-DB passthrough ─────────────────────────────────────────────────
    if len(referenced_dbs) == 0:
        # No db_name. prefix at all — run as-is against... ambiguous. Require qualification.
        raise ParseError(
            "No database prefix found. Use db_name.table notation, e.g. users_db.users"
        )

    if len(referenced_dbs) == 1:
        single_db = next(iter(referenced_dbs))
        # Strip the db_name. prefix so the query runs against the single DB
        passthrough_sql = _strip_db_prefix(ast, {single_db})
        sub = SubQuery(
            db_name=single_db,
            sql=passthrough_sql,
            alias_to_table={a: t for _, t, a in table_refs},
            duckdb_alias="",
        )
        return QueryPlan(
            sub_queries=[sub],
            merge_sql=passthrough_sql,
            referenced_dbs=referenced_dbs,
            is_single_db=True,
        )

    # ── Multi-DB: build sub-queries and merge SQL ─────────────────────────────
    # Group tables by DB
    db_to_tables: dict[str, list[tuple[str, str]]] = {}  # db → [(table_name, alias)]
    for db, table, alias in table_refs:
        db_to_tables.setdefault(db, []).append((table, alias))

    # Ensure all aliases are unique across DBs (DuckDB registration key)
    all_aliases = [a for _, _, a in table_refs]
    if len(all_aliases) != len(set(all_aliases)):
        raise ParseError(
            "Duplicate table aliases found. All tables in a cross-DB query must have unique aliases."
        )

    # Extract WHERE clause predicates
    where_node = ast.find(exp.Where)
    pushable_predicates = _extract_pushable_predicates(where_node, db_to_tables)

    sub_queries: list[SubQuery] = []
    for db_name, tables in db_to_tables.items():
        sq_sql = _build_sub_query(db_name, tables, pushable_predicates.get(db_name, []))
        aliases = {alias: table for table, alias in tables}
        sub_queries.append(SubQuery(
            db_name=db_name,
            sql=sq_sql,
            alias_to_table=aliases,
            duckdb_alias=tables[0][1] if len(tables) == 1 else db_name,
        ))

    merge_sql = _strip_db_prefix(ast, referenced_dbs)

    return QueryPlan(
        sub_queries=sub_queries,
        merge_sql=merge_sql,
        referenced_dbs=referenced_dbs,
        is_single_db=False,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _strip_db_prefix(ast: exp.Expression, dbs: set[str]) -> str:
    """Return SQL with db_name. prefixes removed from all Table nodes."""
    cloned = ast.copy()
    for tbl in cloned.find_all(exp.Table):
        if tbl.db in dbs:
            tbl.set("db", None)
            tbl.set("catalog", None)
    return cloned.sql(dialect="postgres")


def _build_sub_query(
    db_name: str,
    tables: list[tuple[str, str]],  # [(table_name, alias)]
    predicates: list[exp.Expression],
) -> str:
    """Build a SELECT * sub-query for one DB's tables with pushable WHERE predicates."""
    # Build FROM clause
    from_parts = []
    for i, (table, alias) in enumerate(tables):
        if alias == table:
            from_parts.append(table)
        else:
            from_parts.append(f"{table} AS {alias}")

    from_clause = from_parts[0]
    cross_joins = [f"CROSS JOIN {p}" for p in from_parts[1:]]

    sql = f"SELECT * FROM {from_clause}"
    if cross_joins:
        sql += " " + " ".join(cross_joins)

    if predicates:
        combined = " AND ".join(p.sql(dialect="postgres") for p in predicates)
        sql += f" WHERE {combined}"

    return sql


def _extract_pushable_predicates(
    where_node: exp.Where | None,
    db_to_tables: dict[str, list[tuple[str, str]]],
) -> dict[str, list[exp.Expression]]:
    """Extract WHERE predicates that reference only one DB's tables.

    Returns {db_name: [predicate_expressions]}.
    Only simple AND-split predicates are considered (not OR, NOT, subqueries).
    """
    if where_node is None:
        return {}

    # Build alias → db_name lookup
    alias_to_db: dict[str, str] = {}
    for db, tables in db_to_tables.items():
        for table, alias in tables:
            alias_to_db[alias] = db
            alias_to_db[table] = db

    # Split top-level AND conditions
    conditions = _split_and(where_node.this)

    result: dict[str, list[exp.Expression]] = {}
    for cond in conditions:
        # Skip any condition containing a subquery
        if cond.find(exp.Subquery):
            continue

        dbs_referenced = _dbs_in_condition(cond, alias_to_db)
        if len(dbs_referenced) == 1:
            db = next(iter(dbs_referenced))
            result.setdefault(db, []).append(cond)

    return result


def _split_and(node: exp.Expression) -> list[exp.Expression]:
    """Split an expression on top-level AND into individual conditions."""
    if isinstance(node, exp.And):
        return _split_and(node.left) + _split_and(node.right)
    return [node]


def _dbs_in_condition(
    node: exp.Expression, alias_to_db: dict[str, str]
) -> set[str]:
    """Return the set of DB names referenced by column aliases in an expression."""
    dbs: set[str] = set()
    for col in node.find_all(exp.Column):
        table_ref = col.table
        if table_ref and table_ref in alias_to_db:
            dbs.add(alias_to_db[table_ref])
    return dbs
