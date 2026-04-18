"""FastAPI app — DB Simplifier backend."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import load_config
from connections import ConnectionManager
from models import (
    DbStatus,
    EnvironmentsResponse,
    ErrorCode,
    ErrorResponse,
    RunPythonRequest,
    RunPythonResponse,
    RunQueryRequest,
    RunQueryResponse,
    SchemaResponse,
    SwitchEnvRequest,
    SwitchEnvResponse,
    TimingInfo,
)
from query.executor import QueryTimeoutError, RowLimitError, execute_query
from query.parser import ParseError, parse_query
from query.schema import fetch_schema
from sandbox.runner import run_python

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ── App lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    manager = ConnectionManager(config)
    schema_cache: dict = {}

    # Auto-connect to first environment on startup
    first_env = next(iter(config.environments))
    try:
        await manager.switch_env(first_env)
        schema_cache.update(await fetch_schema(manager))
        logger.info("Auto-connected to environment: %s", first_env)
    except Exception as e:
        logger.warning("Could not auto-connect to '%s': %s", first_env, e)

    app.state.manager = manager
    app.state.config = config
    app.state.schema_cache = schema_cache

    yield

    await manager.close()
    logger.info("Shutdown complete")


app = FastAPI(title="DB Simplifier", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Error handler ──────────────────────────────────────────────────────────────

def _error(code: ErrorCode, message: str, detail: str = "", status: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=ErrorResponse(error=message, detail=detail, code=code).model_dump(),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/api/environments", response_model=EnvironmentsResponse)
async def list_environments(request: Request):
    config = request.app.state.config
    return EnvironmentsResponse(environments=list(config.environments.keys()))


@app.post("/api/environments/switch", response_model=SwitchEnvResponse)
async def switch_environment(body: SwitchEnvRequest, request: Request):
    manager: ConnectionManager = request.app.state.manager
    config = request.app.state.config

    if body.env not in config.environments:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown environment: '{body.env}'. Available: {list(config.environments)}",
        )

    try:
        raw_status = await manager.switch_env(body.env)
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e), status=503)

    # Refresh schema cache
    schema = await fetch_schema(manager)
    request.app.state.schema_cache = schema

    status = {k: DbStatus(v) for k, v in raw_status.items()}
    return SwitchEnvResponse(env=body.env, status=status, schema=schema)


@app.get("/api/schema", response_model=SchemaResponse)
async def get_schema(request: Request):
    return SchemaResponse(schema_=request.app.state.schema_cache)


@app.post("/api/query/run", response_model=RunQueryResponse)
async def run_query(body: RunQueryRequest, request: Request):
    manager: ConnectionManager = request.app.state.manager

    if not manager.active_env:
        return _error(ErrorCode.CONNECTION_ERROR, "No active environment. Switch to an environment first.")

    # Parse
    try:
        plan = parse_query(body.sql, manager.known_dbs)
    except ParseError as e:
        return _error(ErrorCode.PARSE_ERROR, str(e))

    # Execute
    try:
        result = await execute_query(plan, manager, body.session_id)
    except RowLimitError as e:
        return _error(ErrorCode.ROW_LIMIT_EXCEEDED, str(e))
    except QueryTimeoutError as e:
        return _error(ErrorCode.TIMEOUT, str(e), status=504)
    except Exception as e:
        logger.exception("Query execution failed")
        return _error(ErrorCode.CONNECTION_ERROR, f"Query failed: {e}", status=500)

    return RunQueryResponse(
        rows=result.rows,
        columns=result.columns,
        row_count=result.row_count,
        timing=TimingInfo(
            total_ms=sum(result.timing_per_db.values()) + result.duckdb_ms,
            per_db=result.timing_per_db,
            duckdb_ms=result.duckdb_ms,
        ),
        session_id=body.session_id,
    )


@app.post("/api/python/run", response_model=RunPythonResponse)
async def run_python_code(body: RunPythonRequest, request: Request):
    result = run_python(body.code, body.session_id)
    return RunPythonResponse(output=result.output, error=result.error)
