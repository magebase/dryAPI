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
sync_concurrency="${SYNC_SECRET_CONCURRENCY:-8}"

if [[ "${sync_concurrency}" != "8" && "${sync_concurrency}" != "16" ]]; then
  echo "SYNC_SECRET_CONCURRENCY must be 8 or 16 (received: ${sync_concurrency}). Falling back to 8."
  sync_concurrency="8"
fi

mapfile -t sync_vars < <(env | cut -d= -f1 | grep '^SYNC_SECRET_' | sort)

if [[ ${#sync_vars[@]} -eq 0 ]]; then
  echo "No SYNC_SECRET_* variables were provided."
  exit 0
fi

echo "Syncing ${#sync_vars[@]} secrets to ${worker_name} with concurrency=${sync_concurrency}."

sync_secret_var() {
  local sync_var="$1"
  local secret_name="${sync_var#SYNC_SECRET_}"
  local secret_value="${!sync_var:-}"

  if [[ -z "${secret_value}" ]]; then
    echo "Skipping ${secret_name}: value is empty"
    return 0
  fi

  # Cloudflare Workers with Versions enabled require `versions secret put`.
  # Fallback to legacy command for older wrangler installations.
  if ! printf "%s" "${secret_value}" | pnpm wrangler versions secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc > /dev/null; then
    printf "%s" "${secret_value}" | pnpm wrangler secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc > /dev/null
  fi

  echo "Synced ${secret_name}"
}

active_jobs=0
failed_jobs=0

for sync_var in "${sync_vars[@]}"; do
  sync_secret_var "${sync_var}" &
  ((active_jobs += 1))

  if (( active_jobs >= sync_concurrency )); then
    if ! wait -n; then
      failed_jobs=1
    fi
    ((active_jobs -= 1))
  fi
done

while (( active_jobs > 0 )); do
  if ! wait -n; then
    failed_jobs=1
  fi
  ((active_jobs -= 1))
done

if (( failed_jobs != 0 )); then
  echo "One or more secret sync operations failed."
  exit 1
fi

echo "Cloudflare secret sync complete for ${worker_name}."
