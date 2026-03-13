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
    find . -type f \
      \( -name "wrangler.json" -o -name "wrangler.jsonc" -o -name "wrangler.toml" \) \
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

echo "Syncing ${#sync_vars[@]} secrets to ${#target_worker_names[@]} workers with concurrency=${sync_concurrency}, retries=${sync_retries}."
for ((index = 0; index < ${#target_worker_names[@]}; index += 1)); do
  echo "  - ${target_worker_names[$index]} (${target_worker_configs[$index]})"
done

is_transient_api_error() {
  local output="$1"

  grep -Eiq 'upstream request timeout|gateway timeout|Received a malformed response from the API|internal server error|temporarily unavailable|service unavailable|timed out|HTTP 5[0-9]{2}|502|503|504|429|rate limit|An unknown error has occurred|request to the Cloudflare API|conflict|in[ -]?progress|try again|please retry|code:[[:space:]]*10013|code:[[:space:]]*7010' <<<"${output}"
}

supports_versions_secret_put() {
  local output="$1"

  if grep -Eiq 'Unknown arguments: versions|Unknown command .*versions|wrangler versions secret put' <<<"${output}"; then
    return 1
  fi

  return 0
}

put_secret_legacy() {
  local secret_name="$1"
  local secret_value="$2"
  local target_worker_name="$3"
  local target_worker_config="$4"
  local -n output_ref=$5
  local -n attempts_ref=$6

  local attempt=1
  local backoff_seconds=2
  local last_output=""

  while :; do
    local output
    if output=$(printf "%s" "${secret_value}" | pnpm wrangler secret put "${secret_name}" --name "${target_worker_name}" --config "${target_worker_config}" 2>&1); then
      output_ref=""
      attempts_ref="${attempt}"
      return 0
    fi

    last_output="${output}"

    if (( attempt >= sync_retries )); then
      break
    fi

    if is_transient_api_error "${output}"; then
      echo "Retrying ${secret_name} for ${target_worker_name} using legacy secret put after transient error (attempt ${attempt}/${sync_retries})..."
    else
      echo "Retrying ${secret_name} for ${target_worker_name} using legacy secret put after error (attempt ${attempt}/${sync_retries})..."
    fi

    sleep "${backoff_seconds}"
    attempt=$((attempt + 1))
    backoff_seconds=$((backoff_seconds * 2))
    if (( backoff_seconds > 30 )); then
      backoff_seconds=30
    fi
  done

  output_ref="${last_output}"
  attempts_ref="${attempt}"
  return 1
}

put_secret_versions() {
  local secret_name="$1"
  local secret_value="$2"
  local target_worker_name="$3"
  local target_worker_config="$4"

  local attempt=1
  local backoff_seconds=2
  local last_output=""
  local versions_supported=1
  local failure_reason=""

  while :; do
    local output
    if output=$(printf "%s" "${secret_value}" | pnpm wrangler versions secret put "${secret_name}" --name "${target_worker_name}" --config "${target_worker_config}" 2>&1); then
      return 0
    fi
    last_output="${output}"

    if ! supports_versions_secret_put "${output}"; then
      versions_supported=0
      failure_reason="versions command unsupported"
      break
    fi

    if (( attempt >= sync_retries )); then
      failure_reason="versions retries exhausted"
      break
    fi

    if is_transient_api_error "${output}"; then
      echo "Retrying ${secret_name} for ${target_worker_name} after transient error (attempt ${attempt}/${sync_retries})..."
    else
      echo "Retrying ${secret_name} for ${target_worker_name} after error (attempt ${attempt}/${sync_retries})..."
    fi

    sleep "${backoff_seconds}"
    attempt=$((attempt + 1))
    backoff_seconds=$((backoff_seconds * 2))
    if (( backoff_seconds > 30 )); then
      backoff_seconds=30
    fi
  done

  local legacy_output=""
  local legacy_attempts=0
  if put_secret_legacy "${secret_name}" "${secret_value}" "${target_worker_name}" "${target_worker_config}" legacy_output legacy_attempts; then
    return 0
  fi

  if (( versions_supported == 0 )); then
    echo "Failed to sync ${secret_name} to ${target_worker_name}: versions API unsupported and legacy secret put failed after ${legacy_attempts} attempt(s)."
    echo "${last_output}" >&2
    if [[ -n "${legacy_output}" ]]; then
      echo "${legacy_output}" >&2
    fi
    return 1
  fi

  if [[ -z "${failure_reason}" ]]; then
    failure_reason="versions attempt failed"
  fi

  echo "Failed to sync ${secret_name} to ${target_worker_name} after versions=${attempt} and legacy=${legacy_attempts} attempt(s): ${failure_reason}."
  echo "${last_output}" >&2
  if [[ -n "${legacy_output}" ]]; then
    echo "${legacy_output}" >&2
  fi

  return 1
}

sync_secret_var() {
  local sync_var="$1"
  local target_worker_name="$2"
  local target_worker_config="$3"
  local secret_name="${sync_var#SYNC_SECRET_}"
  local secret_value="${!sync_var:-}"

  if [[ -z "${secret_value}" ]]; then
    echo "Skipping ${secret_name} for ${target_worker_name}: value is empty"
    return 0
  fi

  if ! put_secret_versions "${secret_name}" "${secret_value}" "${target_worker_name}" "${target_worker_config}"; then
    return 1
  fi

  echo "Synced ${secret_name} -> ${target_worker_name}"
}

active_jobs=0
failed_jobs=0

for ((index = 0; index < ${#target_worker_names[@]}; index += 1)); do
  target_worker_name="${target_worker_names[$index]}"
  target_worker_config="${target_worker_configs[$index]}"

  for sync_var in "${sync_vars[@]}"; do
    sync_secret_var "${sync_var}" "${target_worker_name}" "${target_worker_config}" &
    active_jobs=$((active_jobs + 1))

    if (( active_jobs >= sync_concurrency )); then
      if ! wait -n; then
        failed_jobs=1
      fi
      active_jobs=$((active_jobs - 1))
    fi
  done
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
