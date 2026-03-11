#!/usr/bin/env bash
set -euo pipefail

export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export CALCOM_PORT="${CALCOM_PORT:-3001}"
export PORT="${CALCOM_PORT}"

if command -v pg_isready >/dev/null 2>&1; then
  until pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" >/dev/null 2>&1; do
    sleep 1
  done
fi

if [[ -n "${CALCOM_START_COMMAND:-}" ]]; then
  exec /bin/bash -lc "${CALCOM_START_COMMAND}"
fi

if [[ -x "/entrypoint.sh" ]]; then
  exec /entrypoint.sh
fi

if [[ -x "/usr/local/bin/docker-entrypoint.sh" ]]; then
  exec /usr/local/bin/docker-entrypoint.sh
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm start
fi

if command -v yarn >/dev/null 2>&1; then
  exec yarn start
fi

exec npm run start
