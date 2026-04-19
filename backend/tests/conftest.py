"""Shared pytest fixtures — testcontainers PostgreSQL for integration tests."""

from __future__ import annotations

import asyncio
from typing import Generator

import asyncpg
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer


# ── Container fixture — single server with multiple databases ─────────────────

@pytest.fixture(scope="session")
def pg_container() -> Generator[PostgresContainer, None, None]:
    """A single PostgreSQL container that hosts multiple databases."""
    with PostgresContainer(
        "postgres:16-alpine",
        dbname="postgres",
        username="test",
        password="test",
    ) as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def seeded_server(pg_container):
    """Create and seed users + orders databases on the single server.

    Returns (host, port, user, password) for the server.
    """
    dsn = pg_container.get_connection_url().replace("postgresql+psycopg2", "postgresql")
    from urllib.parse import urlparse
    p = urlparse(dsn)
    host, port, user, password = p.hostname, p.port, p.username, p.password

    # Connect to default postgres DB to create others
    conn = await asyncpg.connect(host=host, port=port, user=user, password=password, database="postgres")
    await conn.execute("CREATE DATABASE users")
    await conn.execute("CREATE DATABASE orders")
    await conn.close()

    # Seed users database
    conn = await asyncpg.connect(host=host, port=port, user=user, password=password, database="users")
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

    # Seed orders database
    conn = await asyncpg.connect(host=host, port=port, user=user, password=password, database="orders")
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

    return host, port, user, password
