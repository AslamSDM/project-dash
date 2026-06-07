#!/usr/bin/env bash
# Start the Go API (:8080) and the Vite dev server (:5173) together.
# Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "→ starting Go API on :8080"
( cd backend && go run . ) &

echo "→ starting Vite dev server on :5173"
( cd frontend && npm run dev ) &

wait
