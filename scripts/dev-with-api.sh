#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_LOG="${TMPDIR:-/tmp}/dryapi-api-dev.log"
HIDDEN_ENV_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dryapi-hidden-env.XXXXXX")"

hide_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    mv "$env_file" "$HIDDEN_ENV_DIR/$(basename "$env_file")"
  fi
}

restore_env_files() {
  for env_name in ".env" ".env.development" ".env.development.local"; do
    if [[ -f "$HIDDEN_ENV_DIR/$env_name" ]]; then
      mv "$HIDDEN_ENV_DIR/$env_name" "$ROOT_DIR/$env_name"
    fi
  done

  rmdir "$HIDDEN_ENV_DIR" >/dev/null 2>&1 || true
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

# `pnpm dev` must only use the local override file.
if [[ ! -f "$ROOT_DIR/.env.local" ]]; then
  echo "[dev] Missing .env.local; aborting." >&2
  exit 1
fi

load_env_file "$ROOT_DIR/.env.local"

# Keep Next.js and Wrangler on the local override file only while the dev
# servers are running.
hide_env_file "$ROOT_DIR/.env"
hide_env_file "$ROOT_DIR/.env.development"
hide_env_file "$ROOT_DIR/.env.development.local"

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

trap 'cleanup; restore_env_files' EXIT INT TERM

# Give the API worker a short head start before Next/Tina boot.
sleep 1

# Cap the Next.js/webpack heap so the two dev servers share RAM rather than
# both growing unbounded and OOM-killing VSCode.
NODE_OPTIONS="--max-old-space-size=2048" pnpm run -s dev:tina
