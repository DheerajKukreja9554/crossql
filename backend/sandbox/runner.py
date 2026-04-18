"""Python sandbox: execute user code in a subprocess with blocked imports and injected DataFrames.

Security model (appropriate for local single-user tool):
- Blocks dangerous stdlib modules via a custom __import__ hook
- Runs in a child subprocess (isolation from main process)
- Hard timeout: 30 seconds
- No network access attempted enforcement (OS-level not enforced in Phase 1)
- DataFrames passed via pickle through a temp file
"""

from __future__ import annotations

import logging
import os
import pickle
import subprocess
import sys
import tempfile
import textwrap
from dataclasses import dataclass

import pandas as pd

from query.executor import QueryResult, session_store

logger = logging.getLogger(__name__)

SANDBOX_TIMEOUT = 30

BLOCKED_MODULES = frozenset({
    "os", "subprocess", "sys", "socket", "shutil",
    "pty", "ctypes", "multiprocessing", "importlib",
    "builtins", "pathlib", "glob", "tempfile",
})

# ── Runner script template ─────────────────────────────────────────────────────
# This is the script that runs in the subprocess.
# It loads pickled DataFrames, sets up the import hook, then exec's user code.

_RUNNER_TEMPLATE = textwrap.dedent("""
import pickle, sys, io

# Load DataFrames from pickle file
with open({pickle_path!r}, 'rb') as f:
    frames = pickle.load(f)

# Inject into globals
for _name, _df in frames.items():
    globals()[_name] = _df

# Block dangerous imports
_BLOCKED = {blocked!r}
_original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

def _safe_import(name, *args, **kwargs):
    top = name.split('.')[0]
    if top in _BLOCKED:
        raise ImportError(f"Import of '{{name}}' is not allowed in the sandbox")
    return _original_import(name, *args, **kwargs)

if hasattr(__builtins__, '__import__'):
    __builtins__.__import__ = _safe_import
else:
    import builtins
    builtins.__import__ = _safe_import

# Execute user code
import pandas as pd
import numpy as np

try:
    exec(compile({user_code!r}, '<user>', 'exec'), globals())
except Exception as e:
    print(f"Error: {{type(e).__name__}}: {{e}}", file=sys.stderr)
""")


@dataclass
class SandboxResult:
    output: str
    error: str | None = None


def run_python(code: str, session_id: str, timeout: int = SANDBOX_TIMEOUT) -> SandboxResult:
    """Execute user Python code in a sandboxed subprocess.

    Args:
        code: Python code string written by the user.
        session_id: UUID of the last query result to inject as DataFrames.
        timeout: Max execution time in seconds.

    Returns:
        SandboxResult with captured stdout and optional error message.
    """
    result = session_store.get(session_id)
    if result is None:
        return SandboxResult(
            output="",
            error="No query result found. Run a SQL query first to load data into the Python cell.",
        )

    frames = _build_frames(result)

    with tempfile.TemporaryDirectory() as tmpdir:
        pickle_path = os.path.join(tmpdir, "frames.pkl")
        script_path = os.path.join(tmpdir, "runner.py")

        with open(pickle_path, "wb") as f:
            pickle.dump(frames, f)

        script = _RUNNER_TEMPLATE.format(
            pickle_path=pickle_path,
            blocked=set(BLOCKED_MODULES),
            user_code=code,
        )
        with open(script_path, "w") as f:
            f.write(script)

        try:
            proc = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return SandboxResult(
                output="",
                error=f"Python execution exceeded {timeout}s timeout",
            )

    stdout = proc.stdout.strip()
    stderr = proc.stderr.strip()

    if proc.returncode != 0 and stderr:
        return SandboxResult(output=stdout, error=stderr)

    return SandboxResult(output=stdout, error=stderr if stderr else None)


def _build_frames(result: QueryResult) -> dict[str, pd.DataFrame]:
    """Build the DataFrame dict to inject into the sandbox.

    Injects:
        df           — the merged/full result
        df_{db_name} — individual DB sub-results
    """
    frames: dict[str, pd.DataFrame] = {}

    if result.merged_df is not None:
        frames["df"] = result.merged_df

    for db_name, sub_df in result.sub_results.items():
        safe_name = f"df_{db_name.replace('-', '_')}"
        frames[safe_name] = sub_df

    return frames
