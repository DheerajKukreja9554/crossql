"""asyncpg connection pool registry with auto-discovery.

Each environment is a single PostgreSQL server. On switch_env, we connect
to the default 'postgres' database, discover all user databases via
pg_database, and create a pool for each.
"""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from config import SYSTEM_DATABASES, AppConfig, EnvironmentConfig

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages asyncpg pools for all databases in the active environment."""

    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._active_env: str | None = None
        self._pools: dict[str, asyncpg.Pool] = {}  # db_name → pool
        self._discovered_dbs: list[str] = []  # all discovered (including excluded)
        self._excluded_dbs: set[str] = set()  # user-excluded + system DBs

    def update_config(self, config: AppConfig) -> None:
        """Hot-swap config (called on /api/config/reload)."""
        self._config = config

    @property
    def active_env(self) -> str | None:
        return self._active_env

    @property
    def known_dbs(self) -> set[str]:
        """DB names with active pools."""
        return set(self._pools.keys())

    @property
    def discovered_dbs(self) -> list[str]:
        """All discovered databases (including excluded ones)."""
        return list(self._discovered_dbs)

    @property
    def excluded_dbs(self) -> set[str]:
        return set(self._excluded_dbs)

    async def switch_env(self, env: str) -> dict[str, str]:
        """Switch to a new environment. Discovers DBs and creates pools.

        Returns:
            {db_name: "ok" | "error"} — connection probe result per DB.
        """
        if env not in self._config.environments:
            raise ValueError(
                f"Unknown environment: '{env}'. Available: {list(self._config.environments)}"
            )

        await self._close_all()

        env_cfg = self._config.environments[env]
        self._active_env = env

        # Step 1: Discover databases
        all_dbs = await self._discover_databases(env_cfg)
        self._discovered_dbs = all_dbs

        # Step 2: Filter out system + user-excluded DBs
        excluded = SYSTEM_DATABASES | set(env_cfg.exclude_databases)
        self._excluded_dbs = excluded
        user_dbs = [db for db in all_dbs if db not in excluded]

        if not user_dbs:
            logger.warning("No user databases found in environment '%s'", env)
            return {}

        # Step 3: Create pools for all user databases concurrently
        results = await asyncio.gather(
            *[self._create_pool(db_name, env_cfg) for db_name in user_dbs],
            return_exceptions=True,
        )

        status: dict[str, str] = {}
        for db_name, result in zip(user_dbs, results):
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

    async def _discover_databases(self, env_cfg: EnvironmentConfig) -> list[str]:
        """Connect to the 'postgres' database and list all databases."""
        try:
            conn = await asyncpg.connect(
                host=env_cfg.host,
                port=env_cfg.port,
                database="postgres",
                user=env_cfg.user,
                password=env_cfg.resolved_password(),
                timeout=10,
            )
            try:
                rows = await conn.fetch(
                    "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
                )
                dbs = [row["datname"] for row in rows]
                logger.info(
                    "Discovered %d databases on %s: %s",
                    len(dbs), env_cfg.host, dbs,
                )
                return dbs
            finally:
                await conn.close()
        except Exception as e:
            logger.error("Database discovery failed on %s: %s", env_cfg.host, e)
            raise

    async def _create_pool(
        self, db_name: str, env_cfg: EnvironmentConfig
    ) -> asyncpg.Pool:
        pool = await asyncpg.create_pool(
            host=env_cfg.host,
            port=env_cfg.port,
            database=db_name,
            user=env_cfg.user,
            password=env_cfg.resolved_password(),
            min_size=1,
            max_size=5,
            command_timeout=70,
        )
        # Verify the connection works
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        logger.info("Connected to %s on %s", db_name, env_cfg.host)
        return pool

    async def _close_all(self) -> None:
        if self._pools:
            await asyncio.gather(*[pool.close() for pool in self._pools.values()])
            self._pools.clear()
            logger.info("Closed all pools for env: %s", self._active_env)
