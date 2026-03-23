#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
WRANGLER_CONFIG="wrangler.jsonc"
WORKER_NAME=""
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/cf-chatbot-ai-search-sync.sh [options]

Syncs Cloudflare AI Search chatbot variables to the site worker using Wrangler secrets.

Options:
  --env-file <path>   Env file with CLOUDFLARE_AI_SEARCH_* keys (default: .env)
  --config <path>     Wrangler config path (default: wrangler.jsonc)
  --worker <name>     Worker name override (default: read from wrangler config)
  --dry-run           Print what would be synced without calling Wrangler
  -h, --help          Show help

Required env keys:
  CLOUDFLARE_AI_SEARCH_ACCOUNT_ID
  CLOUDFLARE_AI_SEARCH_API_TOKEN
  CLOUDFLARE_AI_SEARCH_INDEX

Supported aliases are accepted for compatibility:
  CLOUDFLARE_AI_SEARCH_SERVICE_CF_API_ID -> account id
  CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN,
  CLOUDFLARE_AI_SEARCH_TOKEN -> API token
  CLOUDFLARE_AI_SEARCH_NAME -> index

Optional env keys:
  CLOUDFLARE_AI_SEARCH_SOURCE
  NEXT_PUBLIC_SITE_URL
  SITE_URL
  CLOUDFLARE_AI_SEARCH_ENDPOINT
  CLOUDFLARE_AI_SEARCH_TIMEOUT_MS
  CLOUDFLARE_AI_SEARCH_MAX_RESULTS
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --config)
      WRANGLER_CONFIG="$2"
      shift 2
      ;;
    --worker)
      WORKER_NAME="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$WRANGLER_CONFIG" ]]; then
  echo "Wrangler config not found: $WRANGLER_CONFIG" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required." >&2
  exit 1
fi

declare -A ENV_VALUES=()

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="${raw_line%$'\r'}"
  trimmed="${line#"${line%%[![:space:]]*}"}"

  if [[ -z "$trimmed" || "$trimmed" == \#* ]]; then
    continue
  fi

  if [[ "$trimmed" == export\ * ]]; then
    trimmed="${trimmed#export }"
  fi

  if [[ "$trimmed" != *=* ]]; then
    continue
  fi

  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  key="${key%"${key##*[![:space:]]}"}"

  if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    continue
  fi

  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  ENV_VALUES["$key"]="$value"
done < "$ENV_FILE"

if [[ -z "$WORKER_NAME" ]]; then
  if [[ "$WRANGLER_CONFIG" == *.toml ]]; then
    WORKER_NAME="$(sed -nE 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$WRANGLER_CONFIG" | head -n1)"
  else
    WORKER_NAME="$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$WRANGLER_CONFIG" | head -n1)"
  fi
fi

if [[ -z "$WORKER_NAME" ]]; then
  echo "Unable to determine worker name. Use --worker <name>." >&2
  exit 1
fi

first_non_empty_value() {
  local key
  for key in "$@"; do
    local value="${ENV_VALUES[$key]:-}"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return 0
    fi
  done

  return 1
}

normalize_source_value() {
  local value="$1"
  local trimmed="$value"

  trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"

  if [[ -z "$trimmed" ]]; then
    printf ''
    return 0
  fi

  trimmed="${trimmed%/}"

  if [[ "$trimmed" =~ ^https?:// ]]; then
    if [[ "$trimmed" =~ ^(https?://[^/]+) ]]; then
      printf '%s' "${BASH_REMATCH[1]}"
      return 0
    fi

    printf '%s' "$trimmed"
    return 0
  fi

  if [[ "$trimmed" =~ ^[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
    printf 'https://%s' "$trimmed"
    return 0
  fi

  printf '%s' "$trimmed"
}

account_id="$(first_non_empty_value \
  CLOUDFLARE_AI_SEARCH_ACCOUNT_ID \
  CLOUDFLARE_AI_SEARCH_SERVICE_CF_API_ID || true)"

api_token="$(first_non_empty_value \
  CLOUDFLARE_AI_SEARCH_API_TOKEN \
  CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN \
  CLOUDFLARE_AI_SEARCH_TOKEN || true)"

index_name="$(first_non_empty_value \
  CLOUDFLARE_AI_SEARCH_INDEX \
  CLOUDFLARE_AI_SEARCH_NAME || true)"

optional_keys=(
  "CLOUDFLARE_AI_SEARCH_ENDPOINT"
  "CLOUDFLARE_AI_SEARCH_TIMEOUT_MS"
  "CLOUDFLARE_AI_SEARCH_MAX_RESULTS"
)

if [[ -z "$account_id" ]]; then
  echo "Missing required key in $ENV_FILE: CLOUDFLARE_AI_SEARCH_ACCOUNT_ID (or CLOUDFLARE_AI_SEARCH_SERVICE_CF_API_ID)" >&2
  exit 1
fi

if [[ -z "$api_token" ]]; then
  echo "Missing required key in $ENV_FILE: CLOUDFLARE_AI_SEARCH_API_TOKEN (or a supported token alias)" >&2
  exit 1
fi

if [[ -z "$index_name" ]]; then
  echo "Missing required key in $ENV_FILE: CLOUDFLARE_AI_SEARCH_INDEX (or CLOUDFLARE_AI_SEARCH_NAME)" >&2
  exit 1
fi

echo "Target worker: $WORKER_NAME"
echo "Wrangler config: $WRANGLER_CONFIG"

do_put_secret() {
  local key="$1"
  local value="$2"

  if (( DRY_RUN != 0 )); then
    echo "[dry-run] would sync $key"
    return 0
  fi

  local err_file
  err_file="$(mktemp)"

  if printf '%s' "$value" | pnpm wrangler secret put "$key" --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" >/dev/null 2>"$err_file"; then
    rm -f "$err_file"
    echo "Synced $key"
    return 0
  fi

  if grep -qi "latest version of your Worker isn't currently deployed" "$err_file"; then
    if printf '%s' "$value" | pnpm wrangler versions secret put "$key" --name "$WORKER_NAME" --config "$WRANGLER_CONFIG" >/dev/null 2>"$err_file"; then
      rm -f "$err_file"
      echo "Synced $key (versioned)"
      return 0
    fi
  fi

  local err_line
  err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
  rm -f "$err_file"
  echo "Failed to sync $key${err_line:+: $err_line}" >&2
  return 1
}

do_put_secret "CLOUDFLARE_AI_SEARCH_ACCOUNT_ID" "$account_id"
do_put_secret "CLOUDFLARE_AI_SEARCH_API_TOKEN" "$api_token"
do_put_secret "CLOUDFLARE_AI_SEARCH_INDEX" "$index_name"

source_value="$(first_non_empty_value \
  CLOUDFLARE_AI_SEARCH_SOURCE \
  NEXT_PUBLIC_SITE_URL \
  SITE_URL || true)"

if [[ -n "$source_value" ]]; then
  source_value="$(normalize_source_value "$source_value")"
  do_put_secret "CLOUDFLARE_AI_SEARCH_SOURCE" "$source_value"
fi

for key in "${optional_keys[@]}"; do
  value="${ENV_VALUES[$key]:-}"
  if [[ -z "$value" ]]; then
    continue
  fi

  if [[ "$key" == "CLOUDFLARE_AI_SEARCH_SOURCE" ]]; then
    value="$(normalize_source_value "$value")"
  fi

  do_put_secret "$key" "$value"
done

if (( DRY_RUN != 0 )); then
  echo "Dry run complete."
else
  echo "Cloudflare AI Search chatbot secrets are configured for worker: $WORKER_NAME"
fi
