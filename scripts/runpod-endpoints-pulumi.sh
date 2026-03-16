#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULUMI_DIR="$ROOT_DIR/cloudflare/clients/runpod/pulumi"

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: bash scripts/runpod-endpoints-pulumi.sh <preview|up|deploy|destroy> [stack] [extra pulumi args...]"
  exit 1
fi
shift || true

STACK_NAME="${RUNPOD_PULUMI_STACK:-dev}"
if [[ $# -gt 0 && "${1:0:1}" != "-" ]]; then
  STACK_NAME="$1"
  shift || true
fi

EXTRA_ARGS=("$@")

if command -v pulumi >/dev/null 2>&1; then
  PULUMI_BIN="$(command -v pulumi)"
elif [[ -x "$HOME/.pulumi/bin/pulumi" ]]; then
  PULUMI_BIN="$HOME/.pulumi/bin/pulumi"
else
  echo "Pulumi CLI not found. Install from https://www.pulumi.com/docs/iac/download-install/"
  exit 1
fi

if [[ -z "${PULUMI_CONFIG_PASSPHRASE:-}" && -z "${PULUMI_CONFIG_PASSPHRASE_FILE:-}" ]]; then
  echo "Missing Pulumi secrets passphrase for non-interactive runs."
  echo "Set PULUMI_CONFIG_PASSPHRASE or PULUMI_CONFIG_PASSPHRASE_FILE."
  exit 1
fi

if [[ -z "${CLOUDFLARE_OBJECT_STORAGE_ACCESS_KEY:-}" || -z "${CLOUDFLARE_OBJECT_STORAGE_SECRET_KEY:-}" ]]; then
  echo "Missing Cloudflare Object Storage credentials for R2 Pulumi backend."
  echo "Set CLOUDFLARE_OBJECT_STORAGE_ACCESS_KEY and CLOUDFLARE_OBJECT_STORAGE_SECRET_KEY."
  exit 1
fi

# Pulumi S3 backend consumes AWS_* names; map from Cloudflare R2 credentials.
export AWS_ACCESS_KEY_ID="${CLOUDFLARE_OBJECT_STORAGE_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${CLOUDFLARE_OBJECT_STORAGE_SECRET_KEY}"
export AWS_REGION="auto"

if command -v wrangler >/dev/null 2>&1; then
  WRANGLER_BIN="wrangler"
else
  WRANGLER_BIN="pnpm exec wrangler"
fi

BACKEND_URL="${RUNPOD_PULUMI_BACKEND_URL:-}"
R2_BUCKET="${RUNPOD_PULUMI_STATE_BUCKET:-}"
R2_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

if [[ -n "$BACKEND_URL" && -z "$R2_BUCKET" ]]; then
  if [[ "$BACKEND_URL" =~ ^s3://([^\?]+) ]]; then
    R2_BUCKET="${BASH_REMATCH[1]}"
  fi
fi

if [[ -n "$R2_BUCKET" ]]; then
  echo "[runpod] ensuring R2 state bucket exists via Wrangler: $R2_BUCKET"
  CREATE_OUTPUT="$(mktemp)"
  set +e
  $WRANGLER_BIN r2 bucket create "$R2_BUCKET" >"$CREATE_OUTPUT" 2>&1
  CREATE_STATUS=$?
  set -e

  if [[ $CREATE_STATUS -ne 0 ]]; then
    if grep -qi "already exists" "$CREATE_OUTPUT"; then
      echo "[runpod] R2 bucket already exists: $R2_BUCKET"
    else
      echo "Unable to create/verify R2 bucket '$R2_BUCKET' with Wrangler."
      cat "$CREATE_OUTPUT"
      rm -f "$CREATE_OUTPUT"
      exit 1
    fi
  fi

  rm -f "$CREATE_OUTPUT"
fi

if [[ -z "$BACKEND_URL" ]]; then
  if [[ -n "$R2_BUCKET" && -n "$R2_ACCOUNT_ID" ]]; then
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    BACKEND_URL="s3://${R2_BUCKET}?endpoint=${R2_ENDPOINT}&region=auto&s3ForcePathStyle=true"
  fi
fi

if [[ -z "$BACKEND_URL" ]]; then
  echo "Missing R2 backend configuration for Pulumi state."
  echo "Set RUNPOD_PULUMI_BACKEND_URL, or set RUNPOD_PULUMI_STATE_BUCKET + CLOUDFLARE_ACCOUNT_ID."
  exit 1
fi

pushd "$PULUMI_DIR" >/dev/null

if [[ ! -d node_modules ]]; then
  echo "[runpod] installing Pulumi program dependencies"
  pnpm install
fi

echo "[runpod] logging into R2 Pulumi backend"
"$PULUMI_BIN" login "$BACKEND_URL"

if "$PULUMI_BIN" stack select "$STACK_NAME" >/dev/null 2>&1; then
  echo "[runpod] selected stack: $STACK_NAME"
else
  echo "[runpod] creating stack: $STACK_NAME"
  "$PULUMI_BIN" stack init "$STACK_NAME"
fi

if [[ -n "${RUNPOD_API_KEY:-}" ]]; then
  "$PULUMI_BIN" config set --secret runpod:token "$RUNPOD_API_KEY" --non-interactive >/dev/null
fi

if ! "$PULUMI_BIN" config get runpod:token >/dev/null 2>&1; then
  echo "Missing RunPod API token for Pulumi provider."
  echo "Set RUNPOD_API_KEY or run: pulumi config set --secret runpod:token <YOUR_RUNPOD_API_KEY>"
  exit 1
fi

case "$ACTION" in
  preview)
    "$PULUMI_BIN" preview "${EXTRA_ARGS[@]}"
    ;;
  up)
    "$PULUMI_BIN" up --yes "${EXTRA_ARGS[@]}"
    ;;
  deploy)
    # Alias deploy to pulumi up for clearer CI/manual job naming.
    "$PULUMI_BIN" up --yes "${EXTRA_ARGS[@]}"
    ;;
  destroy)
    "$PULUMI_BIN" destroy --yes "${EXTRA_ARGS[@]}"
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Expected one of: preview, up, deploy, destroy"
    exit 1
    ;;
esac

popd >/dev/null
