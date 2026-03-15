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
  CF_E2E_WORKER_ENV
  CF_E2E_API_HOST
  CF_E2E_API_PORT
  CF_E2E_RUNPOD_BASE_URL
  CF_E2E_API_KEY
  CF_E2E_INTERNAL_API_KEY
  CF_E2E_RUNPOD_API_KEY
  CF_E2E_WEBHOOK_SIGNING_SECRET
  CF_E2E_ENDPOINT_CHAT
  CF_E2E_ENDPOINT_IMAGES
  CF_E2E_ENDPOINT_EMBEDDINGS
  CF_E2E_ENDPOINT_TRANSCRIBE
  CF_E2E_WS_INLINE_MAX_BYTES
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

WORKER_ENV="${CF_E2E_WORKER_ENV:-test}"
API_HOST="${CF_E2E_API_HOST:-127.0.0.1}"
API_PORT="${CF_E2E_API_PORT:-8877}"
RUNPOD_BASE_URL="${CF_E2E_RUNPOD_BASE_URL:-http://127.0.0.1:8878/v2}"

API_KEY="${CF_E2E_API_KEY:-test-api-key}"
INTERNAL_API_KEY="${CF_E2E_INTERNAL_API_KEY:-test-internal-api-key}"
RUNPOD_API_KEY="${CF_E2E_RUNPOD_API_KEY:-test-runpod-api-key}"
WEBHOOK_SIGNING_SECRET="${CF_E2E_WEBHOOK_SIGNING_SECRET:-$INTERNAL_API_KEY}"

RUNPOD_ENDPOINT_ID_CHAT="${CF_E2E_ENDPOINT_CHAT:-e2e-chat-endpoint}"
RUNPOD_ENDPOINT_ID_IMAGES="${CF_E2E_ENDPOINT_IMAGES:-e2e-images-endpoint}"
RUNPOD_ENDPOINT_ID_EMBEDDINGS="${CF_E2E_ENDPOINT_EMBEDDINGS:-e2e-embeddings-endpoint}"
RUNPOD_ENDPOINT_ID_TRANSCRIBE="${CF_E2E_ENDPOINT_TRANSCRIBE:-e2e-transcribe-endpoint}"
WS_INLINE_MAX_BYTES="${CF_E2E_WS_INLINE_MAX_BYTES:-65536}"

VAR_ARGS=(
  --var "API_KEY:$API_KEY"
  --var "INTERNAL_API_KEY:$INTERNAL_API_KEY"
  --var "ORIGIN_URL:http://127.0.0.1:3000"
  --var "RUNPOD_API_KEY:$RUNPOD_API_KEY"
  --var "RUNPOD_API_BASE_URL:$RUNPOD_BASE_URL"
  --var "RUNPOD_ENDPOINT_ID_CHAT:$RUNPOD_ENDPOINT_ID_CHAT"
  --var "RUNPOD_ENDPOINT_ID_IMAGES:$RUNPOD_ENDPOINT_ID_IMAGES"
  --var "RUNPOD_ENDPOINT_ID_EMBEDDINGS:$RUNPOD_ENDPOINT_ID_EMBEDDINGS"
  --var "RUNPOD_ENDPOINT_ID_TRANSCRIBE:$RUNPOD_ENDPOINT_ID_TRANSCRIBE"
  --var "WEBHOOK_SIGNING_SECRET:$WEBHOOK_SIGNING_SECRET"
  --var "WS_INLINE_MAX_BYTES:$WS_INLINE_MAX_BYTES"
)

cd "$ROOT_DIR/cloudflare/api"
WRANGLER_CONFIG_PATH="$ROOT_DIR/cloudflare/api/wrangler.toml"
pnpm --dir "$ROOT_DIR" exec wrangler dev \
  --config "$WRANGLER_CONFIG_PATH" \
  --env "$WORKER_ENV" \
  --env-file "$ENV_FILE" \
  --ip "$API_HOST" \
  --port "$API_PORT" \
  "${VAR_ARGS[@]}" \
  --local
