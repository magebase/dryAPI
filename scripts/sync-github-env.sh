#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--env-file <path>] [--repo <owner/repo>]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

if [[ -z "$REPO" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
fi

if [[ -z "$REPO" ]]; then
  echo "Unable to determine repository. Pass --repo <owner/repo>." >&2
  exit 1
fi

synced=0
skipped=0
invalid=0

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="${raw_line%$'\r'}"
  trimmed="${line#"${line%%[![:space:]]*}"}"

  if [[ -z "$trimmed" || "$trimmed" == \#* ]]; then
    continue
  fi

  if [[ "$trimmed" == export\ * ]]; then
    trimmed="${trimmed#export }"
  fi

  if [[ "$trimmed" != *=* ]]; then
    invalid=$((invalid + 1))
    echo "Skipping invalid line: $line"
    continue
  fi

  key="${trimmed%%=*}"
  value="${trimmed#*=}"

  key="${key%"${key##*[![:space:]]}"}"

  if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    invalid=$((invalid + 1))
    echo "Skipping invalid key: $key"
    continue
  fi

  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  if [[ -z "$value" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  printf '%s' "$value" | gh secret set "$key" --repo "$REPO" >/dev/null
  echo "Synced $key"
  synced=$((synced + 1))
done < "$ENV_FILE"

echo "GitHub secret sync complete for $REPO (synced=$synced skipped_empty=$skipped invalid=$invalid)."
