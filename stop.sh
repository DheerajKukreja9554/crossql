#!/usr/bin/env bash
# Stop CrossQL backend and frontend dev servers.

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.pids"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No .pids file found — trying to kill by process name..."
  pkill -f "uvicorn main:app" 2>/dev/null && echo "  Killed uvicorn" || true
  pkill -f "vite"             2>/dev/null && echo "  Killed vite"    || true
  exit 0
fi

read -r BACKEND_PID FRONTEND_PID < "$PID_FILE"

kill "$BACKEND_PID"  2>/dev/null && echo "Stopped backend  (pid $BACKEND_PID)"  || echo "Backend already stopped"
kill "$FRONTEND_PID" 2>/dev/null && echo "Stopped frontend (pid $FRONTEND_PID)" || echo "Frontend already stopped"

rm -f "$PID_FILE"
rm -f "$ROOT/.log"
echo "Done."
