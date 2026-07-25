# MCP Server

The app exposes its public APIs as a [Model Context Protocol](https://modelcontextprotocol.io) server, built with `mcp-handler` and served from the Next.js app itself.

## Endpoint

```
POST /api/mcp/mcp   (Streamable HTTP transport, stateless)
```

- Local dev: `http://localhost:3000/api/mcp/mcp`
- Production: `https://<your-domain>/api/mcp/mcp`

> The endpoint is **disabled by default** and returns `404` unless
> `MCP_ENABLED=true` — see the decision record below.

## Security & access control (P0-017 decision record)

**Decision (2026-07-20, issue #200 — implemented on the safest fail-closed
default, pending owner ratification):** the public MCP transport is a
non-launch surface, so it is **disabled by default; authenticated and
fail-closed rate-limited when explicitly enabled**. This combines the
"disable" and "auth+rate-limit" options from the Appendix F route matrix
(disable / auth+rate-limit / network-restrict): the endpoint stays off unless
an operator deliberately turns it on, and it can never be reachable
unauthenticated.

| State                                                          | Behavior                                                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_ENABLED` unset or not exactly `true` (default)            | `404 {"error":"not_found"}` — indistinguishable from a nonexistent route                                                                  |
| `MCP_ENABLED=true` but `MCP_API_KEY` not configured            | fail-closed `404` (misconfiguration can never open the endpoint)                                                                          |
| Enabled, request over the rate limit                           | `429 {"error":"rate_limited"}` + `Retry-After`; limiter errors/unavailability also reject (fail closed — see `lib/rate-limit.ts`, P0-011) |
| Enabled, missing/invalid `Authorization: Bearer <MCP_API_KEY>` | `401 {"error":"unauthorized"}` + `WWW-Authenticate: Bearer`                                                                               |
| Enabled, valid key, under the limit                            | request proceeds to the MCP handler                                                                                                       |

- Rate limiting uses the shared `api` bucket, keyed by client IP
  (`mcp:<ip>`), and runs **before** the auth check so Bearer-key brute force
  is capped too (CCR-007).
- Key comparison is constant-time (SHA-256 digests + `timingSafeEqual`), so
  neither the key length nor a matching prefix leaks via timing.
  All tools remain read-only. Default data path is Supabase anon + RLS
  (`published` + `public`). When `DATABASE_PROVIDER=mongodb`, tools use the
  Mongo query layer (`lib/mcp/catalog.ts`) with the same tool names and
  stable JSON envelopes (`id` as string). Search input is still sanitized
  (`sanitizeSearchQuery`).

Guard implementation: `lib/mcp/guard.ts` (`mcpGuard`), applied to all
methods exported by `app/api/mcp/[transport]/route.ts`.

**Enabling (operator):** set `MCP_ENABLED=true` **and** a strong
`MCP_API_KEY` (e.g. `openssl rand -hex 32`) in the deployment environment,
then distribute the key only to trusted MCP clients.

**Rollback:** unset `MCP_ENABLED` (or set it to anything but `true`) — the
transport immediately returns `404`, no code revert needed. Reverting the
guarding commit removes the key requirement.

## Tools

| Tool              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `recommend_books` | Popularity/recency-ranked recommendations, optional genre filter |
| `search_books`    | Text search over published book titles/descriptions              |
| `get_book`        | Full details for a book by ID (author + stats)                   |
| `list_genres`     | Distinct genres with counts                                      |
| `health`          | API and DB connectivity check (includes `provider` field)        |

`get_book` / `exclude_book_ids` accept Supabase UUIDs **or** Mongo ObjectId hex
(dual-run). Tool names and envelopes stay stable across providers.

## Client configuration

All client configs are committed to the repo. **All require `MCP_ENABLED=true` and a
valid `MCP_API_KEY` to connect** — clients receive `404` (disabled) or `401`
(bad/missing key) otherwise.

| Client | File | Auth |
|--------|------|------|
| **VS Code / GitHub Copilot** | `.vscode/mcp.json` | prompts for key via `${input:mcpApiKey}` |
| **Cursor** | `.cursor/mcp.json` | reads `${MCP_API_KEY}` from env |
| **Bob (IBM)** | `.bob/mcp.json` | reads `${MCP_API_KEY}` from env |

### Template for any other MCP client

```json
{
  "mcpServers": {
    "mangu-publishers": {
      "url": "http://localhost:3000/api/mcp/mcp",
      "headers": { "Authorization": "Bearer <your-MCP_API_KEY-value>" }
    }
  }
}
```

For production, replace `http://localhost:3000` with `https://www.mangu-publishers.com`.

### Enable for local dev

```bash
# .env.local
MCP_ENABLED=true
MCP_API_KEY=$(openssl rand -hex 32)   # generate once; save this value for your client

npm run dev
# Verify:
./scripts/mcp-smoke.sh http://localhost:3000 "$MCP_API_KEY"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/mcp-smoke.sh [BASE_URL] [KEY]` | Gate + health + authenticated tool call |
| `scripts/mcp-load-check.sh [BASE_URL] [N]` | Burst test — expects 429s under rate limit |

## Adding tools

Edit [`app/api/mcp/[transport]/route.ts`](../app/api/mcp/[transport]/route.ts) and
register new tools with `server.tool(name, description, zodSchema, handler)`. See
`.claude/skills/mcp-catalog-ops/SKILL.md` for the full checklist.
