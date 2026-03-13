#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
REPO=""
STRICT_MODE=1
PRUNE_MODE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --best-effort)
      STRICT_MODE=0
      shift
      ;;
    --prune)
      PRUNE_MODE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--env-file <path>] [--repo <owner/repo>] [--best-effort] [--prune]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
fi

if [[ -z "$REPO" ]]; then
  echo "Unable to determine repository. Pass --repo <owner/repo>." >&2
  exit 1
fi

synced=0
skipped=0
invalid=0
failed=0
skipped_limit=0
deleted=0
delete_failed=0

MAX_REPO_SECRETS=100
secret_count=0
declare -A existing_secret_keys=()
declare -A declared_secret_keys=()

while read -r secret_name _rest; do
  if [[ -z "$secret_name" ]]; then
    continue
  fi

  existing_secret_keys["$secret_name"]=1
  secret_count=$((secret_count + 1))
done < <(gh secret list --repo "$REPO")

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
    invalid=$((invalid + 1))
    echo "Skipping invalid line: $line"
    continue
  fi

  key="${trimmed%%=*}"
  value="${trimmed#*=}"

  key="${key%"${key##*[![:space:]]}"}"

  if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    invalid=$((invalid + 1))
    echo "Skipping invalid key: $key"
    continue
  fi

  declared_secret_keys["$key"]=1

  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  if [[ -z "$value" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  is_existing_secret=0
  if [[ -n "${existing_secret_keys[$key]+x}" ]]; then
    is_existing_secret=1
  fi

  if (( is_existing_secret == 0 && secret_count >= MAX_REPO_SECRETS )); then
    skipped_limit=$((skipped_limit + 1))
    echo "Skipping $key: repository secret limit ($MAX_REPO_SECRETS) reached"
    continue
  fi

  err_file="$(mktemp)"
  if printf '%s' "$value" | gh secret set "$key" --repo "$REPO" >/dev/null 2>"$err_file"; then
    echo "Synced $key"
    synced=$((synced + 1))
    if (( is_existing_secret == 0 )); then
      existing_secret_keys["$key"]=1
      secret_count=$((secret_count + 1))
    fi
    rm -f "$err_file"
    continue
  fi

  failed=$((failed + 1))
  err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
  rm -f "$err_file"

  if [[ -n "$err_line" ]]; then
    echo "Failed to sync $key: $err_line"
  else
    echo "Failed to sync $key"
  fi

  if (( STRICT_MODE != 0 )); then
    echo "GitHub secret sync aborted after failure (strict mode enabled)."
    exit 1
  fi
done < "$ENV_FILE"

if (( PRUNE_MODE != 0 )); then
  for existing_key in "${!existing_secret_keys[@]}"; do
    if [[ -n "${declared_secret_keys[$existing_key]+x}" ]]; then
      continue
    fi

    err_file="$(mktemp)"
    if gh secret delete "$existing_key" --repo "$REPO" >/dev/null 2>"$err_file"; then
      echo "Deleted $existing_key (missing from $ENV_FILE)"
      deleted=$((deleted + 1))
      rm -f "$err_file"
      continue
    fi

    delete_failed=$((delete_failed + 1))
    err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
    rm -f "$err_file"

    if [[ -n "$err_line" ]]; then
      echo "Failed to delete $existing_key: $err_line"
    else
      echo "Failed to delete $existing_key"
    fi

    if (( STRICT_MODE != 0 )); then
      echo "GitHub secret prune aborted after failure (strict mode enabled)."
      exit 1
    fi
  done
fi

echo "GitHub secret sync complete for $REPO (synced=$synced skipped_empty=$skipped skipped_limit=$skipped_limit invalid=$invalid failed=$failed deleted=$deleted delete_failed=$delete_failed strict_mode=$STRICT_MODE prune_mode=$PRUNE_MODE)."
