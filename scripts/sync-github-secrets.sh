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

mapfile -t sync_vars < <(env | cut -d= -f1 | grep '^SYNC_SECRET_' | sort)

if [[ ${#sync_vars[@]} -eq 0 ]]; then
  echo "No SYNC_SECRET_* variables were provided."
  exit 0
fi

for sync_var in "${sync_vars[@]}"; do
  secret_name="${sync_var#SYNC_SECRET_}"
  secret_value="${!sync_var:-}"

  if [[ -z "${secret_value}" ]]; then
    echo "Skipping ${secret_name}: value is empty"
    continue
  fi

  # Cloudflare Workers with Versions enabled require `versions secret put`.
  # Fallback to legacy command for older wrangler installations.
  if ! printf "%s" "${secret_value}" | pnpm wrangler versions secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc > /dev/null; then
    printf "%s" "${secret_value}" | pnpm wrangler secret put "${secret_name}" --name "${worker_name}" --config wrangler.jsonc > /dev/null
  fi
  echo "Synced ${secret_name}"
done

echo "Cloudflare secret sync complete for ${worker_name}."
