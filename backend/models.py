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

class EnvironmentsResponse(BaseModel):
    environments: list[str]


class SwitchEnvRequest(BaseModel):
    env: str


class DbStatus(str, Enum):
    ok = "ok"
    error = "error"


class SwitchEnvResponse(BaseModel):
    env: str
    status: dict[str, DbStatus]              # {db_name: "ok"|"error"}
    db_schema: dict[str, dict[str, list[str]]]  # SchemaCache: {db: {table: [cols]}}


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
    warning: str | None = None  # e.g. row limit approaching


# ── Python ─────────────────────────────────────────────────────────────────────

class RunPythonRequest(BaseModel):
    code: str
    session_id: str


class RunPythonResponse(BaseModel):
    output: str
    error: str | None = None
