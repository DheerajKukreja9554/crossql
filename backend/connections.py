"""asyncpg connection pool registry with lazy on-demand pool creation.

Each environment is a single PostgreSQL server. On switch_env, we connect
to the 'postgres' database just to discover user databases — no pools are
created upfront. Pools are created on first use (first query or schema fetch).
"""

from __future__ import annotations

import asyncio
import logging

import asyncpg

from config import SYSTEM_DATABASES, AppConfig, EnvironmentConfig

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages asyncpg pools for all databases in the active environment.

    Pools are created lazily — only when a database is actually queried.
    """

    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._active_env: str | None = None
        self._pools: dict[str, asyncpg.Pool] = {}  # db_name → pool (lazily populated)
        self._pool_locks: dict[str, asyncio.Lock] = {}  # prevent duplicate creates
        self._user_dbs: list[str] = []   # discovered user databases (not excluded)
        self._discovered_dbs: list[str] = []  # all discovered (including excluded)
        self._excluded_dbs: set[str] = set()

    def update_config(self, config: AppConfig) -> None:
        """Hot-swap config (called on /api/config/reload)."""
        self._config = config

    @property
    def active_env(self) -> str | None:
        return self._active_env

    @property
    def known_dbs(self) -> set[str]:
        """All non-excluded discovered DBs (whether connected or not)."""
        return set(self._user_dbs)

    @property
    def connected_dbs(self) -> set[str]:
        """DBs with an active pool."""
        return set(self._pools.keys())

    @property
    def discovered_dbs(self) -> list[str]:
        return list(self._discovered_dbs)

    @property
    def excluded_dbs(self) -> set[str]:
        return set(self._excluded_dbs)

    async def switch_env(self, env: str) -> dict[str, str]:
        """Switch to a new environment. Discovers DBs but does NOT create pools.

        Returns:
            {db_name: "discovered"} for all user databases found.
        """
        if env not in self._config.environments:
            raise ValueError(
                f"Unknown environment: '{env}'. Available: {list(self._config.environments)}"
            )

        await self._close_all()

        env_cfg = self._config.environments[env]
        self._active_env = env

        # Discover databases (one lightweight connection to 'postgres' DB)
        all_dbs = await self._discover_databases(env_cfg)
        self._discovered_dbs = all_dbs

        excluded = SYSTEM_DATABASES | set(env_cfg.exclude_databases)
        self._excluded_dbs = excluded
        user_dbs = [db for db in all_dbs if db not in excluded]
        self._user_dbs = user_dbs

        if not user_dbs:
            logger.warning("No user databases found in environment '%s'", env)
            return {}

        logger.info("Env '%s': %d user DBs discovered (pools created on first use)", env, len(user_dbs))
        return {db: "ok" for db in user_dbs}

    async def get_pool(self, db_name: str) -> asyncpg.Pool:
        """Get (or lazily create) the pool for a database."""
        if db_name not in self._user_dbs:
            raise ValueError(
                f"Unknown database '{db_name}'. "
                f"Available: {self._user_dbs}. "
                f"Current env: {self._active_env}"
            )

        # Fast path — pool already exists
        if db_name in self._pools:
            return self._pools[db_name]

        # Ensure only one coroutine creates the pool per db_name
        if db_name not in self._pool_locks:
            self._pool_locks[db_name] = asyncio.Lock()
        async with self._pool_locks[db_name]:
            if db_name in self._pools:  # double-check inside lock
                return self._pools[db_name]
            env_cfg = self._config.environments[self._active_env]  # type: ignore[index]
            pool = await self._create_pool(db_name, env_cfg)
            self._pools[db_name] = pool
            return pool

    async def probe_all(self) -> dict[str, str]:
        """Run SELECT 1 on each active pool to check liveness."""
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
                logger.info("Discovered %d databases on %s", len(dbs), env_cfg.host)
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
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        logger.info("Pool created for %s on %s", db_name, env_cfg.host)
        return pool

    async def _close_all(self) -> None:
        if self._pools:
            await asyncio.gather(*[pool.close() for pool in self._pools.values()])
            self._pools.clear()
            self._pool_locks.clear()
            self._user_dbs = []
            logger.info("Closed all pools for env: %s", self._active_env)
