#!/usr/bin/env bash
# Start CrossQL backend and frontend dev servers.
# PIDs are written to .pids so stop.sh can cleanly shut them down.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.pids"

if [[ -f "$PID_FILE" ]]; then
  echo "CrossQL appears to already be running (.pids exists). Run stop.sh first."
  exit 1
fi

echo "Starting CrossQL..."

# Backend
cd "$ROOT/backend"
uv run uvicorn main:app --port 8000 &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo "$BACKEND_PID $FRONTEND_PID" > "$PID_FILE"

echo "  Backend  → http://localhost:8000  (pid $BACKEND_PID)"
echo "  Frontend → http://localhost:5173  (pid $FRONTEND_PID)"
echo ""
echo "Run ./stop.sh to stop both servers."

wait
