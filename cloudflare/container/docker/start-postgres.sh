#!/usr/bin/env bash
set -euo pipefail

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if command -v pg_ctl >/dev/null 2>&1; then
  PG_BIN_DIR="$(dirname "$(command -v pg_ctl)")"
elif compgen -G "/usr/lib/postgresql/*/bin/pg_ctl" >/dev/null; then
  PG_BIN_DIR="$(dirname "$(ls /usr/lib/postgresql/*/bin/pg_ctl | head -n 1)")"
else
  echo "Unable to locate pg_ctl" >&2
  exit 1
fi

export PATH="${PG_BIN_DIR}:${PATH}"

if [[ "$(id -un)" != "postgres" ]]; then
  if command -v gosu >/dev/null 2>&1; then
    exec gosu postgres postgres -D "${PGDATA}" -p "${POSTGRES_PORT}" -c listen_addresses=127.0.0.1
  fi

  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec postgres postgres -D "${PGDATA}" -p "${POSTGRES_PORT}" -c listen_addresses=127.0.0.1
  fi

  exec su -s /bin/bash postgres -c "postgres -D ${PGDATA} -p ${POSTGRES_PORT} -c listen_addresses=127.0.0.1"
fi

exec postgres -D "${PGDATA}" -p "${POSTGRES_PORT}" -c listen_addresses=127.0.0.1
