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

sync_concurrency="${SECRET_SYNC_CONCURRENCY:-${SYNC_SECRET_CONCURRENCY:-4}}"
sync_retries="${SECRET_SYNC_RETRIES:-6}"

if ! [[ "${sync_retries}" =~ ^[0-9]+$ ]] || (( sync_retries < 1 )); then
  echo "SECRET_SYNC_RETRIES must be a positive integer (received: ${sync_retries}). Falling back to 4."
  sync_retries="4"
fi

if ! [[ "${sync_concurrency}" =~ ^[0-9]+$ ]] || (( sync_concurrency < 1 || sync_concurrency > 16 )); then
  echo "SYNC_SECRET_CONCURRENCY must be an integer between 1 and 16 (received: ${sync_concurrency}). Falling back to 4."
  sync_concurrency="4"
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

discover_worker_targets() {
  local -n names_ref=$1
  local -n configs_ref=$2

  mapfile -t wrangler_configs < <(
    find . -maxdepth 1 -type f \
      \( -name "wrangler.json" -o -name "wrangler.jsonc" -o -name "wrangler.toml" \) \
      -not -name "*.local.json" \
      -not -name "*.local.jsonc" \
      -not -name "*.local.toml" \
      -not -path "*/node_modules/*" \
      | sort
  )

  if [[ ${#wrangler_configs[@]} -eq 0 ]]; then
    echo "No wrangler config files found." >&2
    return 1
  fi

  local -A seen=()

  for config in "${wrangler_configs[@]}"; do
    local worker_name=""

    if [[ "${config}" == *.toml ]]; then
      worker_name="$(sed -nE 's/^[[:space:]]*name[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "${config}" | head -n1)"
    else
      worker_name="$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "${config}" | head -n1)"
    fi

    if [[ -z "${worker_name}" ]]; then
      continue
    fi

    if [[ -n "${seen[${worker_name}]+x}" ]]; then
      continue
    fi

    seen["${worker_name}"]=1
    names_ref+=("${worker_name}")
    configs_ref+=("${config}")
  done

  if [[ ${#names_ref[@]} -eq 0 ]]; then
    echo "No worker names found in wrangler config files." >&2
    return 1
  fi

  return 0
}

declare -a target_worker_names=()
declare -a target_worker_configs=()

discover_worker_targets target_worker_names target_worker_configs

is_transient_api_error() {
  local output="$1"

  grep -Eiq 'upstream request timeout|gateway timeout|Received a malformed response from the API|internal server error|temporarily unavailable|service unavailable|timed out|HTTP 5[0-9]{2}|502|503|504|429|rate limit|An unknown error has occurred|request to the Cloudflare API|conflict|in[ -]?progress|try again|please retry|code:[[:space:]]*10013|code:[[:space:]]*7010' <<<"${output}"
}

build_bulk_secret_payload() {
  local output_file="$1"
  shift

  node - "${output_file}" "$@" <<'NODE'
const fs = require('node:fs')

const outputFile = process.argv[2]
const envNames = process.argv.slice(3)
const payload = {}
let nonEmptyCount = 0

for (const envName of envNames) {
  const value = process.env[envName]
  if (typeof value !== 'string' || value.length === 0) {
    continue
  }

  payload[envName.replace(/^SYNC_SECRET_/, '')] = value
  nonEmptyCount += 1
}

fs.writeFileSync(outputFile, JSON.stringify(payload), 'utf8')
process.stdout.write(String(nonEmptyCount))
NODE
}

sync_worker_secrets_bulk() {
  local target_worker_name="$1"
  local target_worker_config="$2"
  local bulk_payload_file="$3"

  local attempt=1
  local backoff_seconds=2
  local last_output=""

  while :; do
    local output
    if output=$(pnpm wrangler secret bulk "${bulk_payload_file}" --name "${target_worker_name}" --config "${target_worker_config}" --env="" 2>&1); then
      return 0
    fi

    last_output="${output}"

    if (( attempt >= sync_retries )); then
      break
    fi

    if is_transient_api_error "${output}"; then
      echo "Retrying bulk secret sync for ${target_worker_name} after transient error (attempt ${attempt}/${sync_retries})..."
    else
      echo "Retrying bulk secret sync for ${target_worker_name} after error (attempt ${attempt}/${sync_retries})..."
    fi

    sleep "${backoff_seconds}"
    attempt=$((attempt + 1))
    backoff_seconds=$((backoff_seconds * 2))
    if (( backoff_seconds > 30 )); then
      backoff_seconds=30
    fi
  done

  echo "Failed to bulk sync secrets to ${target_worker_name} after ${attempt} attempt(s)."
  echo "${last_output}" >&2
  return 1
}

bulk_secret_payload_file="$(mktemp)"
trap 'rm -f "${bulk_secret_payload_file}"' EXIT

bulk_secret_count="$(build_bulk_secret_payload "${bulk_secret_payload_file}" "${sync_vars[@]}")"

if ! [[ "${bulk_secret_count}" =~ ^[0-9]+$ ]] || (( bulk_secret_count < 1 )); then
  echo "No non-empty SYNC_SECRET_* variables were provided."
  exit 0
fi

echo "Syncing ${bulk_secret_count} secrets to ${#target_worker_names[@]} workers with concurrency=${sync_concurrency}, retries=${sync_retries} using bulk uploads."
for ((index = 0; index < ${#target_worker_names[@]}; index += 1)); do
  echo "  - ${target_worker_names[$index]} (${target_worker_configs[$index]})"
done

active_jobs=0
failed_jobs=0

for ((index = 0; index < ${#target_worker_names[@]}; index += 1)); do
  target_worker_name="${target_worker_names[$index]}"
  target_worker_config="${target_worker_configs[$index]}"

  sync_worker_secrets_bulk "${target_worker_name}" "${target_worker_config}" "${bulk_secret_payload_file}" &
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

echo "Cloudflare secret sync complete for all discovered workers."
