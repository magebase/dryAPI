#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required."
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required."
  exit 1
fi

worker_name="${CLOUDFLARE_WORKER_NAME:-genfix-site}"
sync_concurrency="${SECRET_SYNC_CONCURRENCY:-${SYNC_SECRET_CONCURRENCY:-8}}"
sync_retries="${SECRET_SYNC_RETRIES:-4}"

if ! [[ "${sync_retries}" =~ ^[0-9]+$ ]] || (( sync_retries < 1 )); then
  echo "SECRET_SYNC_RETRIES must be a positive integer (received: ${sync_retries}). Falling back to 4."
  sync_retries="4"
fi

if [[ "${sync_concurrency}" != "8" && "${sync_concurrency}" != "16" ]]; then
  echo "SYNC_SECRET_CONCURRENCY must be 8 or 16 (received: ${sync_concurrency}). Falling back to 8."
  sync_concurrency="8"
fi

mapfile -t sync_vars < <(
  env |
    cut -d= -f1 |
    grep '^SYNC_SECRET_' |
    grep -v '^SYNC_SECRET_CONCURRENCY$' |
    sort
)

if [[ ${#sync_vars[@]} -eq 0 ]]; then
  echo "No SYNC_SECRET_* variables were provided."
  exit 0
fi

echo "Syncing ${#sync_vars[@]} secrets to ${worker_name} with concurrency=${sync_concurrency}, retries=${sync_retries}."

is_transient_versions_error() {
  local output="$1"

  grep -Eiq 'upstream request timeout|gateway timeout|Received a malformed response from the API|internal server error|temporarily unavailable|timed out|HTTP 5[0-9]{2}|502|503|504|429|rate limit' <<<"${output}"
}

supports_versions_secret_put() {
  local output="$1"

  if grep -Eiq 'Unknown arguments: versions|Unknown command .*versions|wrangler versions secret put' <<<"${output}"; then
    return 1
  fi

  return 0
}

put_secret_versions() {
  local secret_name="$1"
  local secret_value="$2"

  local attempt=1
  local backoff_seconds=2

  while :; do
    local output
    if output=$(printf "%s" "${secret_value}" | pnpm wrangler versions secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc 2>&1); then
      return 0
    fi

    if ! supports_versions_secret_put "${output}"; then
      # For older wrangler versions that do not support versions secret APIs.
      if printf "%s" "${secret_value}" | pnpm wrangler secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc > /dev/null; then
        return 0
      fi

      echo "Failed to sync ${secret_name}: versions API unsupported and legacy secret put failed."
      echo "${output}" >&2
      return 1
    fi

    if (( attempt >= sync_retries )) || ! is_transient_versions_error "${output}"; then
      echo "Failed to sync ${secret_name} after ${attempt} attempt(s)."
      echo "${output}" >&2
      return 1
    fi

    echo "Retrying ${secret_name} after transient error (attempt ${attempt}/${sync_retries})..."
    sleep "${backoff_seconds}"
    attempt=$((attempt + 1))
    backoff_seconds=$((backoff_seconds * 2))
  done
}

sync_secret_var() {
  local sync_var="$1"
  local secret_name="${sync_var#SYNC_SECRET_}"
  local secret_value="${!sync_var:-}"

  if [[ -z "${secret_value}" ]]; then
    echo "Skipping ${secret_name}: value is empty"
    return 0
  fi

  if ! put_secret_versions "${secret_name}" "${secret_value}"; then
    return 1
  fi

  echo "Synced ${secret_name}"
}

active_jobs=0
failed_jobs=0

for sync_var in "${sync_vars[@]}"; do
  sync_secret_var "${sync_var}" &
  active_jobs=$((active_jobs + 1))

  if (( active_jobs >= sync_concurrency )); then
    if ! wait -n; then
      failed_jobs=1
    fi
    active_jobs=$((active_jobs - 1))
  fi
done

while (( active_jobs > 0 )); do
  if ! wait -n; then
    failed_jobs=1
  fi
  active_jobs=$((active_jobs - 1))
done

if (( failed_jobs != 0 )); then
  echo "One or more secret sync operations failed."
  exit 1
fi

echo "Cloudflare secret sync complete for ${worker_name}."
