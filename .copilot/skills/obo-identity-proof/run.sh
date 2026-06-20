#!/usr/bin/env bash
# kratos-agent OBO identity-proof runner.
#
# Proves the agent calls the `graph-obo` MCP server AS THE SIGNED-IN USER
# (delegated / On-Behalf-Of), not as the agent's own managed identity.
#
# Installs deps on first run (and chromium only when OBO_BROWSER=1), then runs
# the Playwright suite. Extra args are forwarded to `playwright test`.
#
# Usage:
#   # Headless identity-binding proof (operator supplies a fresh SPA user token):
#   KRATOS_BACKEND_URL=https://<backend> OBO_USER_TOKEN=<jwt> ./run.sh --grep "identity binding"
#
#   # Add the server-level negative test (direct MCP calls):
#   OBO_MCP_URL=https://<fqdn>/mcp ./run.sh --grep "negative"
#
#   # Full authentic proof through a real signed-in Edge over CDP:
#   OBO_BROWSER=1 KRATOS_FRONTEND_URL=https://<swa> OBO_CDP_URL=http://localhost:9222 ./run.sh --grep "browser proof"
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -d node_modules/@playwright/test ]]; then
  echo "[obo-proof] installing npm dependencies …"
  npm install --no-audit --no-fund --silent
fi

if [[ "${OBO_BROWSER:-0}" == "1" ]]; then
  PW_BIN="./node_modules/.bin/playwright"
  if ! "$PW_BIN" install --dry-run chromium >/dev/null 2>&1; then
    echo "[obo-proof] installing chromium for Playwright …"
    "$PW_BIN" install chromium
  fi
fi

echo "[obo-proof] backend       = ${KRATOS_BACKEND_URL:-<unset>}"
echo "[obo-proof] frontend      = ${KRATOS_FRONTEND_URL:-<unset>}"
echo "[obo-proof] mcp server    = ${OBO_MCP_SERVER_NAME:-graph-obo}"
echo "[obo-proof] mcp url        = ${OBO_MCP_URL:-<unset>}"
echo "[obo-proof] user token     = $([[ -n "${OBO_USER_TOKEN:-}" ]] && echo present || echo unset)"
echo "[obo-proof] use-case       = ${OBO_USE_CASE:-generic}"
echo "[obo-proof] browser proof  = ${OBO_BROWSER:-0}"

exec ./node_modules/.bin/playwright test "$@"
