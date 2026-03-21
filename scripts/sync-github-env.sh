#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
REPO=""
STRICT_MODE=1
PRUNE_MODE=0
MAX_PARALLEL_REQUESTS=8

run_set_secret_job() {
  local repo="$1"
  local key="$2"
  local value="$3"
  local result_file="$4"
  local err_file
  local err_line=""

  err_file="$(mktemp)"
  if printf '%s' "$value" | gh secret set "$key" --repo "$repo" >/dev/null 2>"$err_file"; then
    printf 'ok\t%s\t\n' "$key" >"$result_file"
  else
    err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
    printf 'fail\t%s\t%s\n' "$key" "$err_line" >"$result_file"
  fi
  rm -f "$err_file"
}

run_delete_secret_job() {
  local repo="$1"
  local key="$2"
  local result_file="$3"
  local err_file
  local err_line=""

  err_file="$(mktemp)"
  if gh secret delete "$key" --repo "$repo" >/dev/null 2>"$err_file"; then
    printf 'ok\t%s\t\n' "$key" >"$result_file"
  else
    err_line="$(sed -n '1p' "$err_file" | tr -d '\r')"
    printf 'fail\t%s\t%s\n' "$key" "$err_line" >"$result_file"
  fi
  rm -f "$err_file"
}

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
declare -a sync_keys=()
declare -a sync_values=()
declare -a delete_keys=()

while read -r secret_name _rest; do
  if [[ -z "$secret_name" ]]; then
    continue
  fi

  existing_secret_keys["$secret_name"]=1
  secret_count=$((secret_count + 1))
done < <(gh secret list --repo "$REPO")

if (( secret_count > MAX_REPO_SECRETS )); then
  echo "Repository secret count (${secret_count}) exceeds hard limit (${MAX_REPO_SECRETS}). Delete secrets before syncing." >&2
  exit 1
fi

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

  sync_keys+=("$key")
  sync_values+=("$value")
done < "$ENV_FILE"

if (( PRUNE_MODE != 0 )); then
  for existing_key in "${!existing_secret_keys[@]}"; do
    if [[ -n "${declared_secret_keys[$existing_key]+x}" ]]; then
      continue
    fi

    delete_keys+=("$existing_key")
  done

  if (( ${#delete_keys[@]} > 0 )); then
    declare -a delete_pids=()
    declare -a delete_result_files=()
    active_delete_jobs=0

    for i in "${!delete_keys[@]}"; do
      while (( active_delete_jobs >= MAX_PARALLEL_REQUESTS )); do
        wait -n || true
        active_delete_jobs=$((active_delete_jobs - 1))
      done

      result_file="$(mktemp)"
      run_delete_secret_job "$REPO" "${delete_keys[$i]}" "$result_file" &
      delete_pids+=("$!")
      delete_result_files+=("$result_file")
      active_delete_jobs=$((active_delete_jobs + 1))
    done

    for pid in "${delete_pids[@]}"; do
      wait "$pid" || true
    done

    for result_file in "${delete_result_files[@]}"; do
      IFS=$'\t' read -r result_status result_key result_message <"$result_file" || true
      rm -f "$result_file"

      if [[ "$result_status" == "ok" ]]; then
        echo "Deleted $result_key (missing from $ENV_FILE)"
        deleted=$((deleted + 1))
        unset "existing_secret_keys[$result_key]"
        if (( secret_count > 0 )); then
          secret_count=$((secret_count - 1))
        fi
        continue
      fi

      delete_failed=$((delete_failed + 1))
      if [[ -n "$result_message" ]]; then
        echo "Failed to delete $result_key: $result_message"
      else
        echo "Failed to delete $result_key"
      fi
    done
  fi

  if (( delete_failed > 0 && STRICT_MODE != 0 )); then
    echo "GitHub secret prune aborted after failure (strict mode enabled)."
    exit 1
  fi
fi

declare -a sync_dispatch_keys=()
declare -a sync_dispatch_values=()

for i in "${!sync_keys[@]}"; do
  key="${sync_keys[$i]}"
  value="${sync_values[$i]}"

  is_existing_secret=0
  if [[ -n "${existing_secret_keys[$key]+x}" ]]; then
    is_existing_secret=1
  fi

  if (( is_existing_secret == 0 && secret_count >= MAX_REPO_SECRETS )); then
    echo "Repository secret limit (${MAX_REPO_SECRETS}) reached before syncing ${key}. Remove stale secrets and retry." >&2
    exit 1
  fi

  if (( is_existing_secret == 0 )); then
    existing_secret_keys["$key"]=1
    secret_count=$((secret_count + 1))
  fi

  sync_dispatch_keys+=("$key")
  sync_dispatch_values+=("$value")
done

if (( ${#sync_dispatch_keys[@]} > 0 )); then
  declare -a sync_pids=()
  declare -a sync_result_files=()
  active_sync_jobs=0

  for i in "${!sync_dispatch_keys[@]}"; do
    while (( active_sync_jobs >= MAX_PARALLEL_REQUESTS )); do
      wait -n || true
      active_sync_jobs=$((active_sync_jobs - 1))
    done

    result_file="$(mktemp)"
    run_set_secret_job "$REPO" "${sync_dispatch_keys[$i]}" "${sync_dispatch_values[$i]}" "$result_file" &
    sync_pids+=("$!")
    sync_result_files+=("$result_file")
    active_sync_jobs=$((active_sync_jobs + 1))
  done

  for pid in "${sync_pids[@]}"; do
    wait "$pid" || true
  done

  for result_file in "${sync_result_files[@]}"; do
    IFS=$'\t' read -r result_status result_key result_message <"$result_file" || true
    rm -f "$result_file"

    if [[ "$result_status" == "ok" ]]; then
      echo "Synced $result_key"
      synced=$((synced + 1))
      continue
    fi

    failed=$((failed + 1))
    if [[ -n "$result_message" ]]; then
      echo "Failed to sync $result_key: $result_message"
    else
      echo "Failed to sync $result_key"
    fi
  done
fi

if (( failed > 0 && STRICT_MODE != 0 )); then
  echo "GitHub secret sync aborted after failure (strict mode enabled)."
  exit 1
fi

echo "GitHub secret sync complete for $REPO (synced=$synced skipped_empty=$skipped skipped_limit=$skipped_limit invalid=$invalid failed=$failed deleted=$deleted delete_failed=$delete_failed strict_mode=$STRICT_MODE prune_mode=$PRUNE_MODE)."
