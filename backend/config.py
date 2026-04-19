"""Load and validate connections.yaml with ${ENV_VAR} interpolation.

New format: each environment is a server (host/port/user/password).
Databases are auto-discovered via pg_database — not listed in YAML.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import yaml
from pydantic import BaseModel, model_validator


def _interpolate_env_vars(value: str) -> str:
    """Replace ${VAR} with the value of environment variable VAR.

    Raises ValueError if a referenced variable is not set.
    Called lazily when a connection pool is actually created (not at config load time),
    so you can have staging/prod entries in connections.yaml without setting those env vars locally.
    """
    pattern = re.compile(r"\$\{(\w+)\}")

    def replace(match: re.Match) -> str:
        var_name = match.group(1)
        val = os.environ.get(var_name)
        if val is None:
            raise ValueError(
                f"Environment variable '{var_name}' is not set. "
                f"Set it before switching to this environment."
            )
        return val

    return pattern.sub(replace, value)


# System databases to auto-exclude from discovery
SYSTEM_DATABASES = frozenset({
    "postgres", "template0", "template1",
    "azure_maintenance", "azure_sys", "cloudsqladmin",
    "rdsadmin",
})


class EnvironmentConfig(BaseModel):
    """A single PostgreSQL server that may host many databases."""
    host: str
    port: int = 5432
    user: str
    password: str  # may contain ${ENV_VAR} — resolved lazily

    # Optional: databases to exclude beyond system defaults
    exclude_databases: list[str] = []

    def resolved_password(self) -> str:
        """Return the password with ${ENV_VAR} placeholders interpolated."""
        return _interpolate_env_vars(self.password)


class AppConfig(BaseModel):
    environments: dict[str, EnvironmentConfig]

    @model_validator(mode="after")
    def at_least_one_env(self) -> "AppConfig":
        if not self.environments:
            raise ValueError("connections.yaml must define at least one environment")
        return self


def load_config(path: Path | str | None = None) -> AppConfig:
    """Load and validate connections.yaml.

    Args:
        path: Path to config file. Defaults to connections.yaml in project root.

    Raises:
        FileNotFoundError: If connections.yaml does not exist.
        ValueError: If config is invalid.
    """
    if path is None:
        path = Path(__file__).parent.parent / "connections.yaml"
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(
            f"Config file not found: {path}\n"
            "Copy connections.example.yaml to connections.yaml and fill in your credentials."
        )

    with open(path) as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict) or "environments" not in raw:
        raise ValueError("connections.yaml must have a top-level 'environments' key")

    return AppConfig.model_validate(raw)
