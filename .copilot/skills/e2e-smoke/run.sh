#!/usr/bin/env bash
# kratos-agent e2e-smoke runner.
#
# Installs deps + chromium on first run (cached afterwards), then executes
# the Playwright suite. Any extra args are forwarded to `playwright test`.
#
# Usage:
#   ./run.sh                       # all specs, default fruocco-2 endpoints
#   ./run.sh --grep "chat"         # filter to chat spec
#   SKIP_BROWSER=1 ./run.sh        # API-only mode (no chromium)
#   KRATOS_BACKEND_URL=https://...  KRATOS_FRONTEND_URL=https://... ./run.sh
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "[e2e-smoke] installing npm dependencies …"
  npm install --no-audit --no-fund --silent
fi

if [[ -z "${SKIP_BROWSER:-}" ]]; then
  PW_BIN="./node_modules/.bin/playwright"
  if ! "$PW_BIN" install --dry-run chromium >/dev/null 2>&1; then
    echo "[e2e-smoke] installing chromium for Playwright …"
    "$PW_BIN" install chromium
  fi
fi

echo "[e2e-smoke] frontend = ${KRATOS_FRONTEND_URL:-default}"
echo "[e2e-smoke] backend  = ${KRATOS_BACKEND_URL:-default}"
echo "[e2e-smoke] use-cases = ${KRATOS_USE_CASES:-default}"
echo "[e2e-smoke] skip-browser = ${SKIP_BROWSER:-0}"

exec ./node_modules/.bin/playwright test "$@"
