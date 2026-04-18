"""asyncpg connection pool registry — one pool per (env, db_name)."""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from config import AppConfig, DatabaseConfig

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages asyncpg pools for all databases in the active environment."""

    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._active_env: str | None = None
        self._pools: dict[str, asyncpg.Pool] = {}  # db_name → pool

    @property
    def active_env(self) -> str | None:
        return self._active_env

    @property
    def known_dbs(self) -> set[str]:
        """DB names available in the current environment."""
        return set(self._pools.keys())

    async def switch_env(self, env: str) -> dict[str, str]:
        """Switch to a new environment. Creates pools for all DBs, closes old ones.

        Returns:
            {db_name: "ok" | "error"} — connection probe result per DB.
        """
        if env not in self._config.environments:
            raise ValueError(f"Unknown environment: '{env}'. Available: {list(self._config.environments)}")

        # Close existing pools
        await self._close_all()

        env_config = self._config.environments[env]
        self._active_env = env

        # Create new pools and probe connections concurrently
        results = await asyncio.gather(
            *[self._create_pool(db_name, db_cfg) for db_name, db_cfg in env_config.databases.items()],
            return_exceptions=True,
        )

        status: dict[str, str] = {}
        for (db_name, _), result in zip(env_config.databases.items(), results):
            if isinstance(result, Exception):
                logger.warning("Failed to connect to %s: %s", db_name, result)
                status[db_name] = "error"
            else:
                self._pools[db_name] = result
                status[db_name] = "ok"

        return status

    async def get_pool(self, db_name: str) -> asyncpg.Pool:
        """Get the pool for a database in the current environment."""
        if db_name not in self._pools:
            raise ValueError(
                f"No connection for '{db_name}'. "
                f"Available: {list(self._pools)}. "
                f"Current env: {self._active_env}"
            )
        return self._pools[db_name]

    async def probe_all(self) -> dict[str, str]:
        """Run SELECT 1 on each pool to check liveness."""
        results: dict[str, str] = {}
        for db_name, pool in self._pools.items():
            try:
                async with pool.acquire() as conn:
                    await conn.fetchval("SELECT 1")
                results[db_name] = "ok"
            except Exception as e:
                logger.warning("Probe failed for %s: %s", db_name, e)
                results[db_name] = "error"
        return results

    async def close(self) -> None:
        await self._close_all()

    async def _create_pool(self, db_name: str, db_cfg: DatabaseConfig) -> asyncpg.Pool:
        pool = await asyncpg.create_pool(
            host=db_cfg.host,
            port=db_cfg.port,
            database=db_cfg.dbname,
            user=db_cfg.user,
            password=db_cfg.resolved_password(),
            min_size=1,
            max_size=5,
            command_timeout=70,  # slightly above the 60s query timeout
        )
        # Verify the connection works
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        logger.info("Connected to %s (%s)", db_name, db_cfg.host)
        return pool

    async def _close_all(self) -> None:
        if self._pools:
            await asyncio.gather(*[pool.close() for pool in self._pools.values()])
            self._pools.clear()
            logger.info("Closed all pools for env: %s", self._active_env)
