"""Fetch table and column metadata from information_schema for autocomplete."""

from __future__ import annotations

import logging

from connections import ConnectionManager

logger = logging.getLogger(__name__)

# SchemaCache: {db_name: {table_name: [column_name, ...]}}
SchemaCache = dict[str, dict[str, list[str]]]

_TABLES_QUERY = """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
"""

_COLUMNS_QUERY = """
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
"""


async def fetch_schema(manager: ConnectionManager) -> SchemaCache:
    """Fetch schema for all DBs in the active environment.

    Returns a dict: {db_name: {table_name: [column_names]}}.
    Silently skips DBs with connection errors (returns empty dict for them).
    """
    cache: SchemaCache = {}

    for db_name in manager.known_dbs:
        try:
            pool = await manager.get_pool(db_name)
            async with pool.acquire() as conn:
                columns_rows = await conn.fetch(_COLUMNS_QUERY)

            db_schema: dict[str, list[str]] = {}
            for row in columns_rows:
                table = row["table_name"]
                col = row["column_name"]
                db_schema.setdefault(table, []).append(col)

            cache[db_name] = db_schema
            logger.debug("Schema loaded for %s: %d tables", db_name, len(db_schema))
        except Exception as e:
            logger.warning("Could not fetch schema for %s: %s", db_name, e)
            cache[db_name] = {}

    return cache
