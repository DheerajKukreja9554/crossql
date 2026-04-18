"""Unit tests for the Python sandbox runner."""

import pandas as pd
import pytest

from query.executor import QueryResult, session_store
from sandbox.runner import run_python


def _seed_session(session_id: str, df: pd.DataFrame) -> None:
    session_store[session_id] = QueryResult(
        rows=df.to_dict(orient="records"),
        columns=list(df.columns),
        row_count=len(df),
        timing_per_db={"test_db": 10.0},
        duckdb_ms=0.0,
        sub_results={"test_db": df},
        merged_df=df,
    )


class TestBasicExecution:
    def test_print_output_captured(self):
        df = pd.DataFrame({"x": [1, 2, 3]})
        _seed_session("s1", df)
        result = run_python("print('hello world')", "s1")
        assert result.output == "hello world"
        assert result.error is None

    def test_df_injected(self):
        df = pd.DataFrame({"value": [10, 20, 30]})
        _seed_session("s2", df)
        result = run_python("print(df.shape)", "s2")
        assert "(3, 1)" in result.output

    def test_pandas_operations(self):
        df = pd.DataFrame({"amount": [100.0, 200.0, 300.0], "status": ["paid", "paid", "pending"]})
        _seed_session("s3", df)
        result = run_python("print(df[df.status == 'paid'].amount.sum())", "s3")
        assert "300" in result.output


class TestBlacklist:
    def test_os_import_blocked(self):
        df = pd.DataFrame({"x": [1]})
        _seed_session("sb1", df)
        result = run_python("import os", "sb1")
        assert result.error is not None
        assert "os" in result.error.lower() or "not allowed" in result.error.lower()

    def test_subprocess_blocked(self):
        df = pd.DataFrame({"x": [1]})
        _seed_session("sb2", df)
        result = run_python("import subprocess", "sb2")
        assert result.error is not None

    def test_sys_blocked(self):
        df = pd.DataFrame({"x": [1]})
        _seed_session("sb3", df)
        result = run_python("import sys", "sb3")
        assert result.error is not None


class TestEdgeCases:
    def test_no_session_returns_error(self):
        result = run_python("print('hi')", "nonexistent-session-id")
        assert result.error is not None
        assert "query" in result.error.lower() or "session" in result.error.lower()

    def test_syntax_error_in_user_code(self):
        df = pd.DataFrame({"x": [1]})
        _seed_session("se1", df)
        result = run_python("print(", "se1")
        assert result.error is not None

    def test_runtime_error_in_user_code(self):
        df = pd.DataFrame({"x": [1]})
        _seed_session("se2", df)
        result = run_python("raise ValueError('oops')", "se2")
        assert result.error is not None
        assert "ValueError" in result.error
