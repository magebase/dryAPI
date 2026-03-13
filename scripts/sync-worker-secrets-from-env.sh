#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
STRICT_MODE=1
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/sync-worker-secrets-from-env.sh [--env-file <path>] [--best-effort] [--dry-run]

Reads key/value pairs from an env file and syncs every non-empty key to every
Cloudflare Worker discovered from wrangler config files in this repository.

Options:
  --env-file <path>   Path to env file (default: .env)
  --best-effort       Continue syncing even if some keys fail
  --dry-run           Print planned operations without applying changes
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --best-effort)
      STRICT_MODE=0
      shift
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

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required." >&2
  exit 1
fi

declare -A ENV_VALUES=()
invalid_lines=0
skipped_empty=0

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
    invalid_lines=$((invalid_lines + 1))
    continue
  fi

  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  key="${key%"${key##*[![:space:]]}"}"

  if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    invalid_lines=$((invalid_lines + 1))
    continue
  fi

  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  if [[ -z "$value" ]]; then
    skipped_empty=$((skipped_empty + 1))
    continue
  fi

  ENV_VALUES["$key"]="$value"
done < "$ENV_FILE"

mapfile -t ENV_KEYS < <(printf '%s\n' "${!ENV_VALUES[@]}" | sort)

if (( ${#ENV_KEYS[@]} == 0 )); then
  echo "No non-empty keys found in $ENV_FILE"
  exit 1
fi

mapfile -t WRANGLER_CONFIGS < <(
  find . -type f \
    \( -name 'wrangler.json' -o -name 'wrangler.jsonc' -o -name 'wrangler.toml' \) \
    -not -path '*/node_modules/*' \
    | sed 's#^\./##' \
    | sort
)

if (( ${#WRANGLER_CONFIGS[@]} == 0 )); then
  echo "No wrangler config files found." >&2
  exit 1
fi

declare -A WORKER_CONFIG_BY_NAME=()
declare -a WORKER_NAMES=()

for config in "${WRANGLER_CONFIGS[@]}"; do
  worker_name=""

  if [[ "$config" == *.toml ]]; then
    worker_name="$(sed -nE 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$config" | head -n1)"
  else
    worker_name="$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$config" | head -n1)"
  fi

  if [[ -z "$worker_name" ]]; then
    continue
  fi

  if [[ -n "${WORKER_CONFIG_BY_NAME[$worker_name]+x}" ]]; then
    continue
  fi

  WORKER_CONFIG_BY_NAME["$worker_name"]="$config"
  WORKER_NAMES+=("$worker_name")
done

if (( ${#WORKER_NAMES[@]} == 0 )); then
  echo "No worker names found in wrangler config files." >&2
  exit 1
fi

synced=0
failed=0

echo "Discovered workers: ${WORKER_NAMES[*]}"
echo "Syncing ${#ENV_KEYS[@]} keys from $ENV_FILE"

for worker in "${WORKER_NAMES[@]}"; do
  config="${WORKER_CONFIG_BY_NAME[$worker]}"
  echo "--- Worker: $worker (config: $config) ---"

  for key in "${ENV_KEYS[@]}"; do
    value="${ENV_VALUES[$key]}"

    if (( DRY_RUN != 0 )); then
      echo "[dry-run] would sync $key -> $worker"
      continue
    fi

    err_file="$(mktemp)"
    if printf '%s' "$value" | pnpm wrangler secret put "$key" --name "$worker" --config "$config" >/dev/null 2>"$err_file"; then
      synced=$((synced + 1))
      rm -f "$err_file"
      continue
    fi

    failed=$((failed + 1))
    err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
    rm -f "$err_file"
    echo "Failed: $key -> $worker ${err_line:+($err_line)}"

    if (( STRICT_MODE != 0 )); then
      echo "Aborting after first failure (strict mode enabled)."
      exit 1
    fi
  done
done

if (( DRY_RUN != 0 )); then
  echo "Dry run complete (invalid_lines=$invalid_lines skipped_empty=$skipped_empty)."
  exit 0
fi

echo "Sync complete (synced=$synced failed=$failed invalid_lines=$invalid_lines skipped_empty=$skipped_empty strict_mode=$STRICT_MODE)."

if (( failed > 0 && STRICT_MODE != 0 )); then
  exit 1
fi
