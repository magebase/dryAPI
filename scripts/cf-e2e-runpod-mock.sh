#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${CF_E2E_ENV_FILE:-$ROOT_DIR/.env.test}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing E2E env file: $ENV_FILE" >&2
  echo "Create it from .env.test.example" >&2
  exit 1
fi

E2E_KEYS=(
  CF_E2E_RUNPOD_PORT
  CF_E2E_RUNPOD_API_KEY
)

declare -A E2E_OVERRIDES=()
for key in "${E2E_KEYS[@]}"; do
  E2E_OVERRIDES["$key"]="${!key-__UNSET__}"
done

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for key in "${E2E_KEYS[@]}"; do
  value="${E2E_OVERRIDES[$key]}"
  if [[ "$value" != "__UNSET__" ]]; then
    printf -v "$key" '%s' "$value"
    export "$key"
  fi
done

node "$ROOT_DIR/cloudflare/api/test/e2e/mock-runpod-server.mjs"
