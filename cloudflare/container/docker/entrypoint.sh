#!/usr/bin/env bash
set -euo pipefail

export PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB="${POSTGRES_DB:-calcom}"
export POSTGRES_USER="${POSTGRES_USER:-calcom}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_PASSWORD must be set" >&2
  exit 1
fi

/usr/local/bin/init-postgres.sh
exec /usr/bin/supervisord -c /etc/supervisord.conf
