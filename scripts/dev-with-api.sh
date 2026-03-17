#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_LOG="${TMPDIR:-/tmp}/dryapi-api-dev.log"

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

# Load local development env defaults before booting dev servers.
# Order matters: later files override earlier ones.
load_env_file "$ROOT_DIR/.env"
load_env_file "$ROOT_DIR/.env.development"
load_env_file "$ROOT_DIR/.env.local"
load_env_file "$ROOT_DIR/.env.development.local"

# Cap the wrangler Node.js heap. workerd (the C++ binary it spawns) is separate,
# but bounding the Node wrapper prevents the pnpm/wrangler orchestration layer from
# competing with Next.js for the same memory pool.
NODE_OPTIONS="--max-old-space-size=512" pnpm run -s dev:api >"$API_LOG" 2>&1 &
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

# Cap the Next.js/webpack heap so the two dev servers share RAM rather than
# both growing unbounded and OOM-killing VSCode.
NODE_OPTIONS="--max-old-space-size=2048" pnpm run -s dev:tina
