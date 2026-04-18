"""Shared pytest fixtures — testcontainers PostgreSQL for integration tests."""

from __future__ import annotations

import asyncio
from typing import Generator

import asyncpg
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer


# ── Container fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def users_container() -> Generator[PostgresContainer, None, None]:
    with PostgresContainer("postgres:16-alpine", dbname="users", username="test", password="test") as pg:
        yield pg


@pytest.fixture(scope="session")
def orders_container() -> Generator[PostgresContainer, None, None]:
    with PostgresContainer("postgres:16-alpine", dbname="orders", username="test", password="test") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def seeded_dbs(users_container, orders_container):
    """Seed both containers with test data. Returns (users_dsn, orders_dsn)."""
    users_dsn = users_container.get_connection_url().replace("postgresql+psycopg2", "postgresql")
    orders_dsn = orders_container.get_connection_url().replace("postgresql+psycopg2", "postgresql")

    # Seed users
    conn = await asyncpg.connect(users_dsn)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            active BOOLEAN DEFAULT true
        )
    """)
    await conn.execute("""
        INSERT INTO users (name, email, active) VALUES
        ('Alice', 'alice@test.com', true),
        ('Bob', 'bob@test.com', true),
        ('Charlie', 'charlie@test.com', false)
    """)
    await conn.close()

    # Seed orders
    conn = await asyncpg.connect(orders_dsn)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            total NUMERIC(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending'
        )
    """)
    await conn.execute("""
        INSERT INTO orders (user_id, total, status) VALUES
        (1, 299.00, 'paid'),
        (2, 89.99, 'pending'),
        (1, 149.50, 'paid')
    """)
    await conn.close()

    return users_dsn, orders_dsn
