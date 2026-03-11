#!/usr/bin/env bash
set -euo pipefail

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"

find_pg_bin_dir() {
  if command -v pg_ctl >/dev/null 2>&1; then
    dirname "$(command -v pg_ctl)"
    return
  fi

  local candidate
  for candidate in /usr/lib/postgresql/*/bin; do
    if [[ -x "${candidate}/pg_ctl" ]]; then
      echo "${candidate}"
      return
    fi
  done

  echo "Unable to locate PostgreSQL binaries" >&2
  exit 1
}

PG_BIN_DIR="$(find_pg_bin_dir)"
export PATH="${PG_BIN_DIR}:${PATH}"

mkdir -p "${PGDATA}"
chown -R postgres:postgres "${PGDATA}"
chmod 700 "${PGDATA}"

run_as_postgres() {
  if command -v gosu >/dev/null 2>&1; then
    gosu postgres "$@"
    return
  fi

  if command -v su-exec >/dev/null 2>&1; then
    su-exec postgres "$@"
    return
  fi

  local quoted
  printf -v quoted '%q ' "$@"
  su -s /bin/bash postgres -c "${quoted}"
}

if [[ ! -f "${PGDATA}/PG_VERSION" ]]; then
  run_as_postgres initdb -D "${PGDATA}"
fi

run_as_postgres pg_ctl -D "${PGDATA}" -o "-p ${POSTGRES_PORT} -c listen_addresses=127.0.0.1" -w start

run_as_postgres psql -v ON_ERROR_STOP=1 --dbname=postgres <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;
SQL

db_exists="$(run_as_postgres psql -tA --dbname=postgres -c "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}'")"
if [[ "${db_exists}" != "1" ]]; then
  run_as_postgres psql -v ON_ERROR_STOP=1 --dbname=postgres -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"
fi

run_as_postgres pg_ctl -D "${PGDATA}" -m fast -w stop
