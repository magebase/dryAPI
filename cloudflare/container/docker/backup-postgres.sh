#!/usr/bin/env bash
set -euo pipefail

required_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required variable: ${name}" >&2
    exit 1
  fi
}

required_var POSTGRES_PASSWORD
required_var POSTGRES_USER
required_var POSTGRES_DB
required_var POSTGRES_PORT
required_var R2_ACCESS_KEY_ID
required_var R2_SECRET_ACCESS_KEY
required_var R2_BUCKET
required_var R2_ENDPOINT

backup_dir="${CALCOM_BACKUP_DIR:-/data/backups/postgres}"
prefix="${R2_BACKUP_PREFIX:-calcom/postgres}"
mkdir -p "${backup_dir}"

if command -v pg_dump >/dev/null 2>&1; then
  PG_BIN_DIR="$(dirname "$(command -v pg_dump)")"
elif compgen -G "/usr/lib/postgresql/*/bin/pg_dump" >/dev/null; then
  PG_BIN_DIR="$(dirname "$(ls /usr/lib/postgresql/*/bin/pg_dump | head -n 1)")"
else
  echo "Unable to locate pg_dump" >&2
  exit 1
fi

export PATH="${PG_BIN_DIR}:${PATH}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file_name="${POSTGRES_DB}-${stamp}.sql.gz"
local_file="${backup_dir}/${file_name}"
remote_key="${prefix%/}/${file_name}"

pg_dump \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --format=plain \
  --host=127.0.0.1 \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  "${POSTGRES_DB}" | gzip -9 > "${local_file}"

aws s3 cp \
  "${local_file}" \
  "s3://${R2_BUCKET}/${remote_key}" \
  --endpoint-url "${R2_ENDPOINT}" \
  --storage-class STANDARD_IA

# Keep only local scratch backups from the last 2 days to avoid disk growth.
find "${backup_dir}" -type f -name "*.sql.gz" -mtime +2 -delete

echo "Backup uploaded to s3://${R2_BUCKET}/${remote_key} with STANDARD_IA"
