"""Integration tests for the query executor. Requires Docker."""

from __future__ import annotations

import pytest

from config import AppConfig, EnvironmentConfig
from connections import ConnectionManager
from query.executor import execute_query
from query.parser import parse_query


def _make_config(host: str, port: int, user: str, password: str) -> AppConfig:
    """Build an AppConfig from server connection details."""
    return AppConfig(environments={
        "test": EnvironmentConfig(
            host=host,
            port=port,
            user=user,
            password=password,
        )
    })


@pytest.mark.asyncio
async def test_cross_db_join(seeded_server):
    host, port, user, password = seeded_server
    config = _make_config(host, port, user, password)

    manager = ConnectionManager(config)
    await manager.switch_env("test")

    # Verify auto-discovery found our databases
    assert "users" in manager.known_dbs
    assert "orders" in manager.known_dbs

    sql = """
    SELECT u.name, o.total, o.status
    FROM users.users u
    JOIN orders.orders o ON u.id = o.user_id
    WHERE u.active = true AND o.status = 'paid'
    ORDER BY o.total DESC
    """
    plan = parse_query(sql, manager.known_dbs)
    result = await execute_query(plan, manager, session_id="test-session")

    await manager.close()

    assert result.row_count > 0
    assert "name" in result.columns
    assert "total" in result.columns
    for row in result.rows:
        assert row["status"] == "paid"


@pytest.mark.asyncio
async def test_single_db_passthrough(seeded_server):
    host, port, user, password = seeded_server
    config = _make_config(host, port, user, password)

    manager = ConnectionManager(config)
    await manager.switch_env("test")

    sql = "SELECT * FROM users.users WHERE active = true"
    plan = parse_query(sql, manager.known_dbs)
    assert plan.is_single_db is True

    result = await execute_query(plan, manager, session_id="test-single")
    await manager.close()

    assert result.row_count == 2  # Alice and Bob are active
    assert result.duckdb_ms == 0.0  # DuckDB not used for single-DB


@pytest.mark.asyncio
async def test_auto_discovery(seeded_server):
    """Verify that the connection manager auto-discovers databases."""
    host, port, user, password = seeded_server
    config = _make_config(host, port, user, password)

    manager = ConnectionManager(config)
    status = await manager.switch_env("test")

    # Should have discovered users and orders
    assert "users" in status
    assert "orders" in status
    assert status["users"] == "ok"
    assert status["orders"] == "ok"

    # postgres should be excluded as system DB
    assert "postgres" not in status

    # discovered_dbs should include all (even excluded ones)
    assert "postgres" in manager.discovered_dbs
    assert "users" in manager.discovered_dbs
    assert "orders" in manager.discovered_dbs

    await manager.close()
