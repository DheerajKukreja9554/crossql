"""Saved queries — read/write ~/.crossql/saved_queries.json."""

from __future__ import annotations

import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel

logger = logging.getLogger(__name__)

QUERIES_DIR = Path.home() / ".crossql"
QUERIES_FILE = QUERIES_DIR / "saved_queries.json"


class SavedQuery(BaseModel):
    id: str
    name: str
    sql: str
    folder: str = ""
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> list[SavedQuery]:
    if not QUERIES_FILE.exists():
        return []
    try:
        raw = json.loads(QUERIES_FILE.read_text())
        return [SavedQuery(**q) for q in raw]
    except Exception as e:
        logger.warning("Corrupted saved_queries.json (%s) — backing up and starting fresh", e)
        bak = QUERIES_FILE.with_suffix(".json.bak")
        shutil.copy2(QUERIES_FILE, bak)
        QUERIES_FILE.write_text("[]")
        return []


def _save(queries: list[SavedQuery]) -> None:
    QUERIES_DIR.mkdir(parents=True, exist_ok=True)
    QUERIES_FILE.write_text(
        json.dumps([q.model_dump() for q in queries], indent=2, ensure_ascii=False)
    )


def get_queries() -> list[SavedQuery]:
    return _load()


def create_query(name: str, sql: str, folder: str = "") -> SavedQuery:
    queries = _load()
    now = _now()
    q = SavedQuery(id=str(uuid.uuid4()), name=name, sql=sql, folder=folder, created_at=now, updated_at=now)
    queries.append(q)
    _save(queries)
    return q


def update_query(query_id: str, **kwargs) -> SavedQuery:
    queries = _load()
    for q in queries:
        if q.id == query_id:
            for k, v in kwargs.items():
                if hasattr(q, k) and k not in ("id", "created_at"):
                    setattr(q, k, v)
            q.updated_at = _now()
            _save(queries)
            return q
    raise ValueError(f"Query '{query_id}' not found")


def delete_query(query_id: str) -> None:
    queries = _load()
    new = [q for q in queries if q.id != query_id]
    if len(new) == len(queries):
        raise ValueError(f"Query '{query_id}' not found")
    _save(new)
