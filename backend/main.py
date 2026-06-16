"""FastAPI app — CrossQL backend."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pathlib import Path

import asyncpg

from config import (
    SYSTEM_DATABASES,
    add_environment,
    delete_environment,
    load_config,
    update_environment,
)
from connections import ConnectionManager
from models import (
    ConnectionInfo,
    ConnectionsListResponse,
    CreateConnectionRequest,
    CreateConnectionResponse,
    CreateQueryRequest,
    DbStatus,
    EnvironmentInfo,
    EnvironmentsResponse,
    ErrorCode,
    ErrorResponse,
    ReloadConfigResponse,
    RunPythonRequest,
    RunPythonResponse,
    RunQueryRequest,
    RunQueryResponse,
    SavedQueriesResponse,
    SavedQueryModel,
    SchemaResponse,
    SwitchEnvRequest,
    SwitchEnvResponse,
    TestConnectionRequest,
    TestConnectionResponse,
    TimingInfo,
    UpdateConnectionRequest,
    UpdateQueryRequest,
)
from queries import create_query, delete_query, get_queries, update_query
from query.executor import QueryTimeoutError, RowLimitError, execute_query
from query.parser import ParseError, parse_query
from query.schema import fetch_schema
from sandbox.runner import run_python

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "backend.log"),
    ],
)
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


app = FastAPI(title="CrossQL", version="0.2.0", lifespan=lifespan)

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
    manager: ConnectionManager = request.app.state.manager
    envs = [
        EnvironmentInfo(
            name=name,
            host=env_cfg.host,
            port=env_cfg.port,
            user=env_cfg.user,
        )
        for name, env_cfg in config.environments.items()
    ]
    return EnvironmentsResponse(environments=envs, active=manager.active_env)


@app.post("/api/environments/switch", response_model=SwitchEnvResponse)
async def switch_environment(body: SwitchEnvRequest, request: Request):
    manager: ConnectionManager = request.app.state.manager
    config = request.app.state.config

    if body.env not in config.environments:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown environment: '{body.env}'. Available: {list(config.environments)}",
        )

    env_cfg = config.environments[body.env]

    try:
        raw_status = await manager.switch_env(body.env)
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e), status=503)

    # Refresh schema cache
    schema = await fetch_schema(manager)
    request.app.state.schema_cache = schema

    status = {k: DbStatus(v) for k, v in raw_status.items()}
    return SwitchEnvResponse(
        env=body.env,
        host=env_cfg.host,
        status=status,
        db_schema=schema,
        discovered_dbs=manager.discovered_dbs,
        excluded_dbs=sorted(manager.excluded_dbs),
    )


@app.post("/api/config/reload", response_model=ReloadConfigResponse)
async def reload_config(request: Request):
    """Reload connections.yaml and re-discover databases for the active environment."""
    manager: ConnectionManager = request.app.state.manager

    # Reload YAML
    try:
        config = load_config()
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, f"Failed to reload config: {e}")

    request.app.state.config = config
    manager.update_config(config)

    # Re-switch to current environment (re-discovers DBs)
    active_env = manager.active_env
    if not active_env or active_env not in config.environments:
        active_env = next(iter(config.environments))

    env_cfg = config.environments[active_env]

    try:
        raw_status = await manager.switch_env(active_env)
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e), status=503)

    schema = await fetch_schema(manager)
    request.app.state.schema_cache = schema

    status = {k: DbStatus(v) for k, v in raw_status.items()}
    return ReloadConfigResponse(
        env=active_env,
        host=env_cfg.host,
        status=status,
        db_schema=schema,
        discovered_dbs=manager.discovered_dbs,
        excluded_dbs=sorted(manager.excluded_dbs),
    )


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


# ── Connection CRUD ───────────────────────────────────────────────────────────

@app.get("/api/connections", response_model=ConnectionsListResponse)
async def list_connections(request: Request):
    config = request.app.state.config
    envs = [
        ConnectionInfo(
            name=name,
            host=cfg.host,
            port=cfg.port,
            user=cfg.user,
            has_password=bool(cfg.password or cfg.password_encrypted),
            needs_reauth=cfg.needs_reauth,
            exclude_databases=cfg.exclude_databases,
        )
        for name, cfg in config.environments.items()
    ]
    return ConnectionsListResponse(environments=envs)


@app.post("/api/connections/test", response_model=TestConnectionResponse)
async def test_connection(body: TestConnectionRequest):
    """Test a connection and discover databases without saving."""
    try:
        conn = await asyncpg.connect(
            host=body.host, port=body.port, user=body.user,
            password=body.password, database="postgres", timeout=10,
        )
        try:
            rows = await conn.fetch(
                "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
            )
            dbs = [r["datname"] for r in rows if r["datname"] not in SYSTEM_DATABASES]
            return TestConnectionResponse(status="ok", discovered_dbs=dbs)
        finally:
            await conn.close()
    except Exception as e:
        return TestConnectionResponse(status="error", error=str(e))


@app.post("/api/connections", response_model=CreateConnectionResponse)
async def create_connection(body: CreateConnectionRequest, request: Request):
    """Add a new environment with encrypted password."""
    try:
        config = add_environment(
            name=body.name, host=body.host, port=body.port,
            user=body.user, password=body.password,
            exclude_databases=body.exclude_databases,
        )
        request.app.state.config = config
        request.app.state.manager.update_config(config)

        # Try connecting to discover DBs
        try:
            status = await request.app.state.manager.switch_env(body.name)
            schema = await fetch_schema(request.app.state.manager)
            request.app.state.schema_cache = schema
            return CreateConnectionResponse(
                name=body.name, status="ok",
                discovered_dbs=request.app.state.manager.discovered_dbs,
            )
        except Exception as e:
            return CreateConnectionResponse(name=body.name, status="error", discovered_dbs=[])
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e))


@app.put("/api/connections/{env_name}", response_model=CreateConnectionResponse)
async def update_connection(env_name: str, body: UpdateConnectionRequest, request: Request):
    """Update an existing environment."""
    try:
        kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
        config = update_environment(env_name, **kwargs)
        request.app.state.config = config
        request.app.state.manager.update_config(config)
        return CreateConnectionResponse(name=env_name, status="ok", discovered_dbs=[])
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e))


@app.delete("/api/connections/{env_name}")
async def remove_connection(env_name: str, request: Request):
    """Remove an environment."""
    manager: ConnectionManager = request.app.state.manager
    if manager.active_env == env_name:
        return _error(ErrorCode.CONNECTION_ERROR, "Cannot delete the active environment. Switch to another first.")
    try:
        config = delete_environment(env_name)
        request.app.state.config = config
        manager.update_config(config)
        return {"deleted": True}
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e))


# ── Saved Queries ─────────────────────────────────────────────────────────────

@app.get("/api/queries", response_model=SavedQueriesResponse)
async def list_queries():
    queries = get_queries()
    return SavedQueriesResponse(queries=[SavedQueryModel(**q.model_dump()) for q in queries])


@app.post("/api/queries", response_model=SavedQueryModel)
async def save_query(body: CreateQueryRequest):
    try:
        q = create_query(name=body.name, sql=body.sql, folder=body.folder)
        return SavedQueryModel(**q.model_dump())
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e))


@app.put("/api/queries/{query_id}", response_model=SavedQueryModel)
async def edit_query(query_id: str, body: UpdateQueryRequest):
    try:
        kwargs = {k: v for k, v in body.model_dump().items() if v is not None}
        q = update_query(query_id, **kwargs)
        return SavedQueryModel(**q.model_dump())
    except ValueError as e:
        return _error(ErrorCode.NOT_FOUND, str(e), status=404)
    except Exception as e:
        return _error(ErrorCode.CONNECTION_ERROR, str(e))


@app.delete("/api/queries/{query_id}")
async def remove_query(query_id: str):
    try:
        delete_query(query_id)
        return {"deleted": True}
    except ValueError as e:
        return _error(ErrorCode.NOT_FOUND, str(e), status=404)
