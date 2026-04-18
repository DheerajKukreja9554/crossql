"""Load and validate connections.yaml with ${ENV_VAR} interpolation."""

from __future__ import annotations

import os
import re
from pathlib import Path

import yaml
from pydantic import BaseModel, field_validator, model_validator


class DatabaseConfig(BaseModel):
    host: str
    port: int
    dbname: str
    user: str
    password: str

    @field_validator("password", mode="before")
    @classmethod
    def interpolate_env_vars(cls, v: str) -> str:
        """Replace ${VAR} with the value of environment variable VAR."""
        pattern = re.compile(r"\$\{(\w+)\}")

        def replace(match: re.Match) -> str:
            var_name = match.group(1)
            value = os.environ.get(var_name)
            if value is None:
                raise ValueError(f"Environment variable '{var_name}' is not set")
            return value

        return pattern.sub(replace, str(v))

    @property
    def dsn(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.dbname}"


class EnvironmentConfig(BaseModel):
    databases: dict[str, DatabaseConfig]

    @model_validator(mode="after")
    def at_least_one_db(self) -> "EnvironmentConfig":
        if not self.databases:
            raise ValueError("Each environment must define at least one database")
        return self


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
        ValueError: If config is invalid or required env vars are missing.
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
