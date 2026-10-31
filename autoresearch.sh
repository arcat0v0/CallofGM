#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")"

output="$(bun scripts/parity/verify.ts 2>&1)"
status=$?

printf '%s\n' "$output"

if [ "$status" -ne 0 ]; then
  exit "$status"
fi

if ! printf '%s\n' "$output" | grep -q '^METRIC '; then
  echo "parity harness produced no METRIC lines" >&2
  exit 1
fi

exit 0
