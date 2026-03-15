#!/usr/bin/env bash
set -euo pipefail

API_LOG="${TMPDIR:-/tmp}/dryapi-api-dev.log"

pnpm run -s dev:api >"$API_LOG" 2>&1 &
API_PID=$!

cleanup() {
  if kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

# Give the API worker a short head start before Next/Tina boot.
sleep 1

tinacms dev -c "next dev --webpack"
