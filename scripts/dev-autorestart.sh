#!/usr/bin/env bash
set -u

cleanup_dev_processes() {
  pkill -f "@tinacms/cli/bin/tinacms dev -c next dev" || true
  pkill -f "next/dist/bin/next dev" || true
}

stop_requested=0
handle_stop() {
  stop_requested=1
  cleanup_dev_processes
}

trap handle_stop INT TERM

while true; do
  cleanup_dev_processes

  pnpm dev
  exit_code=$?

  if [[ $stop_requested -eq 1 ]]; then
    exit 0
  fi

  # Don't auto-restart after Ctrl+C from the dev command itself.
  if [[ $exit_code -eq 130 ]]; then
    exit 0
  fi

  echo "[dev:auto] pnpm dev exited with code ${exit_code}. Restarting in 2s..."
  sleep 2
done
