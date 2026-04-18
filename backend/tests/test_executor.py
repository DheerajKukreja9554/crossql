"""Integration tests for the query executor. Requires Docker."""

from __future__ import annotations

import pytest

from config import AppConfig, DatabaseConfig, EnvironmentConfig
from connections import ConnectionManager
from query.executor import execute_query
from query.parser import parse_query


def _make_config(users_dsn: str, orders_dsn: str) -> AppConfig:
    """Build an AppConfig from DSNs returned by testcontainers."""
    def dsn_to_cfg(dsn: str, dbname: str) -> DatabaseConfig:
        # DSN format: postgresql://user:pass@host:port/dbname
        from urllib.parse import urlparse
        p = urlparse(dsn)
        return DatabaseConfig(
            host=p.hostname,
            port=p.port,
            dbname=dbname,
            user=p.username,
            password=p.password,
        )

    return AppConfig(environments={
        "test": EnvironmentConfig(databases={
            "users_db": dsn_to_cfg(users_dsn, "users"),
            "orders_db": dsn_to_cfg(orders_dsn, "orders"),
        })
    })


@pytest.mark.asyncio
async def test_cross_db_join(seeded_dbs):
    users_dsn, orders_dsn = seeded_dbs
    config = _make_config(users_dsn, orders_dsn)

    manager = ConnectionManager(config)
    await manager.switch_env("test")

    sql = """
    SELECT u.name, o.total, o.status
    FROM users_db.users u
    JOIN orders_db.orders o ON u.id = o.user_id
    WHERE u.active = true AND o.status = 'paid'
    ORDER BY o.total DESC
    """
    plan = parse_query(sql, manager.known_dbs)
    result = await execute_query(plan, manager, session_id="test-session")

    await manager.close()

    assert result.row_count > 0
    assert "name" in result.columns
    assert "total" in result.columns
    # All results should be paid and active users
    for row in result.rows:
        assert row["status"] == "paid"


@pytest.mark.asyncio
async def test_single_db_passthrough(seeded_dbs):
    users_dsn, orders_dsn = seeded_dbs
    config = _make_config(users_dsn, orders_dsn)

    manager = ConnectionManager(config)
    await manager.switch_env("test")

    sql = "SELECT * FROM users_db.users WHERE active = true"
    plan = parse_query(sql, manager.known_dbs)
    assert plan.is_single_db is True

    result = await execute_query(plan, manager, session_id="test-single")
    await manager.close()

    assert result.row_count == 2  # Alice and Bob are active
    assert result.duckdb_ms == 0.0  # DuckDB not used for single-DB
