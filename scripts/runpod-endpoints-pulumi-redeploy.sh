#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STACK_NAME="${RUNPOD_PULUMI_STACK:-dev}"

if [[ $# -gt 0 ]]; then
  STACK_NAME="$1"
fi

echo "[runpod] using Pulumi stack: $STACK_NAME"

echo "[runpod] destroying existing managed endpoints BEFORE rebuild"
bash "$ROOT_DIR/scripts/runpod-endpoints-pulumi.sh" destroy "$STACK_NAME" --skip-preview

echo "[runpod] optimizing GPU revenue profile"
node "$ROOT_DIR/scripts/optimize-runpod-gpu-revenue.mjs" --write

echo "[runpod] rebuilding endpoint manifest/create-requests"
node "$ROOT_DIR/scripts/build-runpod-image-endpoints.mjs"

echo "[runpod] applying rebuilt endpoints with Pulumi"
bash "$ROOT_DIR/scripts/runpod-endpoints-pulumi.sh" up "$STACK_NAME" --skip-preview

echo "[runpod] redeploy complete"
