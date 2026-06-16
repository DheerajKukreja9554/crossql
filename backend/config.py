"""Load, validate, and save connections.yaml.

Each environment is a server (host/port/user/password).
Passwords can be plaintext, ${ENV_VAR}, or Fernet-encrypted.
Databases are auto-discovered via pg_database.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

import yaml
from cryptography.fernet import InvalidToken
from pydantic import BaseModel, model_validator

from encryption import decrypt, encrypt

logger = logging.getLogger(__name__)


def _interpolate_env_vars(value: str) -> str:
    """Replace ${VAR} with environment variable value. Raises if not set."""
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


SYSTEM_DATABASES = frozenset({
    "postgres", "template0", "template1",
    "azure_maintenance", "azure_sys", "cloudsqladmin",
    "rdsadmin",
})

DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "connections.yaml"


class EnvironmentConfig(BaseModel):
    """A single PostgreSQL server that may host many databases."""
    host: str
    port: int = 5432
    user: str
    password: str = ""  # plaintext or ${ENV_VAR}
    password_encrypted: Optional[str] = None  # Fernet-encrypted password
    exclude_databases: list[str] = []

    def resolved_password(self) -> str:
        """Decrypt or interpolate password. Encrypted takes priority."""
        if self.password_encrypted:
            try:
                return decrypt(self.password_encrypted)
            except InvalidToken:
                raise ValueError(
                    f"Cannot decrypt password for {self.host}. "
                    "Machine key may have changed. Re-enter password via UI."
                )
        if self.password:
            return _interpolate_env_vars(self.password)
        raise ValueError(f"No password configured for {self.host}")

    @property
    def needs_reauth(self) -> bool:
        """Check if encrypted password is undecryptable."""
        if not self.password_encrypted:
            return False
        try:
            decrypt(self.password_encrypted)
            return False
        except InvalidToken:
            return True


class AppConfig(BaseModel):
    environments: dict[str, EnvironmentConfig]

    @model_validator(mode="after")
    def at_least_one_env(self) -> "AppConfig":
        if not self.environments:
            raise ValueError("connections.yaml must define at least one environment")
        return self


def load_config(path: Path | str | None = None) -> AppConfig:
    """Load and validate connections.yaml."""
    if path is None:
        path = DEFAULT_CONFIG_PATH
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


def save_config(config: AppConfig, path: Path | str | None = None) -> None:
    """Write config back to connections.yaml, preserving comments where possible."""
    if path is None:
        path = DEFAULT_CONFIG_PATH
    path = Path(path)

    # Build YAML-friendly dict
    data: dict = {"environments": {}}
    for env_name, env_cfg in config.environments.items():
        entry: dict = {
            "host": env_cfg.host,
            "port": env_cfg.port,
            "user": env_cfg.user,
        }
        if env_cfg.password_encrypted:
            entry["password_encrypted"] = env_cfg.password_encrypted
        elif env_cfg.password:
            entry["password"] = env_cfg.password
        if env_cfg.exclude_databases:
            entry["exclude_databases"] = env_cfg.exclude_databases
        data["environments"][env_name] = entry

    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    logger.info("Saved config to %s", path)


def add_environment(
    name: str, host: str, port: int, user: str, password: str,
    exclude_databases: list[str] | None = None,
    path: Path | str | None = None,
) -> AppConfig:
    """Add a new environment with encrypted password. Returns updated config."""
    config = load_config(path)
    encrypted = encrypt(password)
    config.environments[name] = EnvironmentConfig(
        host=host,
        port=port,
        user=user,
        password_encrypted=encrypted,
        exclude_databases=exclude_databases or [],
    )
    save_config(config, path)
    return config


def update_environment(
    name: str, path: Path | str | None = None, **kwargs,
) -> AppConfig:
    """Update an existing environment. Re-encrypts password if provided."""
    config = load_config(path)
    if name not in config.environments:
        raise ValueError(f"Environment '{name}' not found")
    env = config.environments[name]
    for key, val in kwargs.items():
        if key == "password" and val:
            setattr(env, "password_encrypted", encrypt(val))
            setattr(env, "password", "")
        elif hasattr(env, key):
            setattr(env, key, val)
    save_config(config, path)
    return config


def delete_environment(name: str, path: Path | str | None = None) -> AppConfig:
    """Remove an environment from config. Returns updated config."""
    config = load_config(path)
    if name not in config.environments:
        raise ValueError(f"Environment '{name}' not found")
    del config.environments[name]
    save_config(config, path)
    return config
