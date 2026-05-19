#!/usr/bin/env bash
# Assert the active compactc version matches .compactc-version before regenerating
# managed/ artifacts. Newer compactc emits code targeting a runtime version the
# midnight-js stack may not have caught up with yet (see the bboard template's
# identical check). Pin lives at <repo>/.compactc-version.

set -e

here="$(cd "$(dirname "$0")/.." && pwd)"
expected_file="$here/.compactc-version"
if [[ ! -f "$expected_file" ]]; then
  echo "check-compactc: missing $expected_file" >&2
  exit 2
fi
expected="$(tr -d '[:space:]' < "$expected_file")"

# Compact installer drops PATH config here; non-interactive npm shells don't source it.
if ! command -v compact >/dev/null 2>&1; then
  [[ -f "$HOME/.local/bin/env" ]] && . "$HOME/.local/bin/env"
fi
if ! command -v compact >/dev/null 2>&1; then
  echo "check-compactc: 'compact' not on PATH (install via compact installer?)" >&2
  exit 2
fi

actual="$(compact compile --version 2>&1 | tr -d '[:space:]')"
if [[ "$actual" != "$expected" ]]; then
  cat >&2 <<EOF
check-compactc: compactc version mismatch
  expected: $expected (pinned in .compactc-version)
  active:   $actual
Fix: compact update $expected
EOF
  exit 1
fi
echo "check-compactc: compactc $actual matches pinned $expected"
