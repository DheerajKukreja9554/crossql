"""Pydantic request/response models for all API endpoints."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


# ── Error ──────────────────────────────────────────────────────────────────────

class ErrorCode(str, Enum):
    PARSE_ERROR = "PARSE_ERROR"
    ROW_LIMIT_EXCEEDED = "ROW_LIMIT_EXCEEDED"
    CONNECTION_ERROR = "CONNECTION_ERROR"
    TIMEOUT = "TIMEOUT"
    SANDBOX_ERROR = "SANDBOX_ERROR"
    NOT_FOUND = "NOT_FOUND"


class ErrorResponse(BaseModel):
    error: str
    detail: str
    code: ErrorCode


# ── Environments ───────────────────────────────────────────────────────────────

class EnvironmentInfo(BaseModel):
    name: str
    host: str
    port: int
    user: str


class EnvironmentsResponse(BaseModel):
    environments: list[EnvironmentInfo]
    active: str | None = None


class SwitchEnvRequest(BaseModel):
    env: str


class DbStatus(str, Enum):
    ok = "ok"
    error = "error"


class SwitchEnvResponse(BaseModel):
    env: str
    host: str
    status: dict[str, DbStatus]                 # {db_name: "ok"|"error"}
    db_schema: dict[str, dict[str, list[str]]]  # SchemaCache
    discovered_dbs: list[str]                    # all discovered DBs
    excluded_dbs: list[str]                      # system/excluded DBs


# ── Config Reload ─────────────────────────────────────────────────────────────

class ReloadConfigResponse(BaseModel):
    env: str
    host: str
    status: dict[str, DbStatus]
    db_schema: dict[str, dict[str, list[str]]]
    discovered_dbs: list[str]
    excluded_dbs: list[str]


# ── Schema ─────────────────────────────────────────────────────────────────────

class SchemaResponse(BaseModel):
    schema_: dict[str, dict[str, list[str]]]  # {db_name: {table_name: [col_names]}}

    class Config:
        populate_by_name = True


# ── Query ──────────────────────────────────────────────────────────────────────

class RunQueryRequest(BaseModel):
    sql: str
    session_id: str


class TimingInfo(BaseModel):
    total_ms: float
    per_db: dict[str, float]    # {db_name: elapsed_ms}
    duckdb_ms: float


class RunQueryResponse(BaseModel):
    rows: list[dict[str, Any]]
    columns: list[str]
    row_count: int
    timing: TimingInfo
    session_id: str
    warning: str | None = None


# ── Python ─────────────────────────────────────────────────────────────────────

class RunPythonRequest(BaseModel):
    code: str
    session_id: str


class RunPythonResponse(BaseModel):
    output: str
    error: str | None = None


# ── Connections CRUD ──────────────────────────────────────────────────────────

class ConnectionInfo(BaseModel):
    name: str
    host: str
    port: int
    user: str
    has_password: bool
    needs_reauth: bool
    exclude_databases: list[str] = []


class ConnectionsListResponse(BaseModel):
    environments: list[ConnectionInfo]


class CreateConnectionRequest(BaseModel):
    name: str
    host: str
    port: int = 5432
    user: str
    password: str
    exclude_databases: list[str] = []


class CreateConnectionResponse(BaseModel):
    name: str
    status: str  # "ok" | "error"
    discovered_dbs: list[str]


class UpdateConnectionRequest(BaseModel):
    host: str | None = None
    port: int | None = None
    user: str | None = None
    password: str | None = None
    exclude_databases: list[str] | None = None


class TestConnectionRequest(BaseModel):
    host: str
    port: int = 5432
    user: str
    password: str


class TestConnectionResponse(BaseModel):
    status: str  # "ok" | "error"
    discovered_dbs: list[str] = []
    error: str | None = None


# ── Saved Queries ─────────────────────────────────────────────────────────────

class SavedQueryModel(BaseModel):
    id: str
    name: str
    sql: str
    folder: str = ""
    created_at: str
    updated_at: str


class SavedQueriesResponse(BaseModel):
    queries: list[SavedQueryModel]


class CreateQueryRequest(BaseModel):
    name: str
    sql: str
    folder: str = ""


class UpdateQueryRequest(BaseModel):
    name: str | None = None
    sql: str | None = None
    folder: str | None = None
