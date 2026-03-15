#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULUMI_DIR="$ROOT_DIR/cloudflare/clients/runpod/pulumi"

ACTION="${1:-}"
if [[ -z "$ACTION" ]]; then
  echo "Usage: bash scripts/runpod-endpoints-pulumi.sh <preview|up|destroy> [stack] [extra pulumi args...]"
  exit 1
fi
shift || true

STACK_NAME="${RUNPOD_PULUMI_STACK:-dev}"
if [[ $# -gt 0 && "${1:0:1}" != "-" ]]; then
  STACK_NAME="$1"
  shift || true
fi

EXTRA_ARGS=("$@")

if ! command -v pulumi >/dev/null 2>&1; then
  echo "Pulumi CLI not found. Install from https://www.pulumi.com/docs/iac/download-install/"
  exit 1
fi

if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  echo "Missing AWS credentials for R2 Pulumi backend."
  echo "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (R2 API token pair)."
  exit 1
fi

BACKEND_URL="${RUNPOD_PULUMI_BACKEND_URL:-}"

if [[ -z "$BACKEND_URL" ]]; then
  R2_BUCKET="${RUNPOD_PULUMI_STATE_BUCKET:-}"
  R2_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"

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
pulumi login "$BACKEND_URL"

if pulumi stack select "$STACK_NAME" >/dev/null 2>&1; then
  echo "[runpod] selected stack: $STACK_NAME"
else
  echo "[runpod] creating stack: $STACK_NAME"
  pulumi stack init "$STACK_NAME"
fi

if [[ -n "${RUNPOD_API_KEY:-}" ]]; then
  pulumi config set --secret runpod:token "$RUNPOD_API_KEY" --non-interactive >/dev/null
fi

if ! pulumi config get runpod:token >/dev/null 2>&1; then
  echo "Missing RunPod API token for Pulumi provider."
  echo "Set RUNPOD_API_KEY or run: pulumi config set --secret runpod:token <YOUR_RUNPOD_API_KEY>"
  exit 1
fi

case "$ACTION" in
  preview)
    pulumi preview "${EXTRA_ARGS[@]}"
    ;;
  up)
    pulumi up --yes "${EXTRA_ARGS[@]}"
    ;;
  destroy)
    pulumi destroy --yes "${EXTRA_ARGS[@]}"
    ;;
  *)
    echo "Unknown action: $ACTION"
    echo "Expected one of: preview, up, destroy"
    exit 1
    ;;
esac

popd >/dev/null
