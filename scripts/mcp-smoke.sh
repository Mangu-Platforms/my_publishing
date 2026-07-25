#!/usr/bin/env bash
# Smoke-check the MCP gate and health HTTP surface.
# Verifies operational gates without a full MCP client.
#
# Usage:
#   ./scripts/mcp-smoke.sh [BASE_URL] [MCP_API_KEY]
#
# Examples:
#   ./scripts/mcp-smoke.sh                                 # localhost, no key (expect 404)
#   ./scripts/mcp-smoke.sh http://localhost:3000 mykey     # localhost, with auth
#   ./scripts/mcp-smoke.sh https://www.mangu-publishers.com "$MCP_API_KEY"
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
API_KEY="${2:-}"

echo "=== Mangu MCP Smoke Check ==="
echo "Target: ${BASE_URL}"
echo

# ── 1. App health ────────────────────────────────────────────────────────────
echo "== App health (/api/health) =="
curl -fsS --max-time 20 "${BASE_URL}/api/health" | head -c 500 || true
echo
echo

# ── 2. MCP endpoint (unauthenticated) ────────────────────────────────────────
echo "== MCP endpoint (no auth, expect 404 or 401) =="
CODE="$(curl -sS -o /tmp/mcp-smoke-body.txt -w '%{http_code}' --max-time 20 \
  -X POST "${BASE_URL}/api/mcp/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mangu-smoke","version":"0.1.0"}}}')"
echo "HTTP ${CODE}"
head -c 400 /tmp/mcp-smoke-body.txt; echo

case "${CODE}" in
  404) echo "INFO: MCP disabled (404) — set MCP_ENABLED=true to proceed." ;;
  401) echo "INFO: MCP enabled, auth required (401) — pass MCP_API_KEY as \$2 to test tools." ;;
  429) echo "WARN: rate limited (429)" ;;
  200|202|406) echo "WARN: MCP responded without auth — check MCP_API_KEY is configured!" ;;
  *) echo "FAIL: unexpected status ${CODE}" >&2; exit 1 ;;
esac
echo

# ── 3. Authenticated tool call (only if a key was supplied) ──────────────────
if [[ -n "${API_KEY}" ]]; then
  echo "== MCP tool call: health (with Bearer key) =="
  AUTH_CODE="$(curl -sS -o /tmp/mcp-smoke-auth.txt -w '%{http_code}' --max-time 20 \
    -X POST "${BASE_URL}/api/mcp/mcp" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${API_KEY}" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"health","arguments":{}}}')"
  echo "HTTP ${AUTH_CODE}"
  head -c 600 /tmp/mcp-smoke-auth.txt; echo

  case "${AUTH_CODE}" in
    200|202)
      echo "OK: authenticated tool call succeeded."
      ;;
    401)
      echo "FAIL: key rejected — verify MCP_API_KEY matches the server value." >&2
      exit 1
      ;;
    429)
      echo "WARN: rate limited — try again after Retry-After."
      ;;
    *)
      echo "FAIL: unexpected status ${AUTH_CODE}" >&2
      exit 1
      ;;
  esac
else
  echo "== Skipping authenticated tool call (pass MCP_API_KEY as \$2 to enable) =="
fi

echo
echo "=== Smoke check complete ==="
