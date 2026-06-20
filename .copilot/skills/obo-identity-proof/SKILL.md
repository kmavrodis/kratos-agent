# obo-identity-proof — prove the agent calls the MCP server as the signed-in user

A repo-local Playwright skill that **proves** the kratos agent's calls to the
Entra-protected `graph-obo` MCP server run **as the signed-in human**
(delegated / On-Behalf-Of), and **not** as the agent's own managed identity.

The clincher is **identity binding**: the Entra object id (`oid`) inside the
user's access token must equal the `id` that Microsoft Graph `/me` returns
*through the tool*. Graph `/me` only resolves in a delegated user context, so a
matching `oid` is dispositive proof the OBO exchange happened for that exact
principal.

## The demo prompt

> "Use your Microsoft Graph profile tool to look me up and report, for the
> signed-in user: (1) displayName, (2) userPrincipalName, and (3) my Entra
> object id (the `id` field). Answer ONLY from the tool result."

Ask this in the deployed UI while signed in. The agent calls `graph-obo` →
`get_my_profile`, which performs the OBO token exchange and hits Graph `/me`.
The returned `id` is the signed-in user's `oid`. Run this skill to assert that
binding automatically.

## When to use

- After deploying the OBO stack (`azd up` / `azd deploy`) to confirm the
  end-to-end delegated-identity path works against a real environment.
- In a demo/review to **show** the agent uses the caller's identity, with a
  machine-checked assertion rather than a hand-wave.
- After changing anything on the OBO path: the MCP server (`src/obo-mcp-server`),
  the token-injection wiring (`mcpAccessTokens`), the Entra app regs
  (`infra/modules/obo-entra-app.bicep`), or the frontend MSAL sign-in.

## When NOT to use

- General deployment health — use the `e2e-smoke` skill.
- Pure backend unit changes — `uv run pytest` in `src/backend`.
- When no OBO MCP server is deployed (the specs self-skip without inputs).

## What it tests

| Spec | Level | Asserts |
|------|-------|---------|
| `01-identity-binding.spec.ts` | agent (headless) | With a real SPA user token attached under `mcpAccessTokens`, the "who am I" answer contains the **token's `oid`** (== Graph `/me` `id`) and the UPN; the raw bearer never appears in the chat stream. **This is the core proof.** |
| `02-negative.spec.ts` | agent + server | (a) WITHOUT a user token the agent must **not** return a real profile (no silent fallback to the managed identity). (b) Direct MCP calls with **no bearer** and a **wrong-client** (Azure CLI) token are both rejected (`unauthorized` / `obo_failed`) — enforces the user token + confused-deputy allow-list. |
| `03-browser-proof.spec.ts` | full stack (real sign-in) | Gated by `OBO_BROWSER=1`. Connects to a running Edge over CDP, drives the real frontend sign-in, captures the `/api/agent/chat` POST body to read the token the **frontend** attached, and asserts the rendered answer contains that token's `oid` + UPN and the raw token is never visible on the page. |

Why three levels: 01 proves the binding deterministically with an operator-supplied
token; 02 proves it is **not spoofable** and there is no managed-identity fallback;
03 proves the **whole stack** (real MSAL sign-in → SPA token → backend pass-through
→ hosted-agent injection → OBO → Graph) end-to-end with zero hand-fed tokens.

## Inputs (env vars)

| Var | Used by | Purpose |
|-----|---------|---------|
| `KRATOS_BACKEND_URL` (or `OBO_BACKEND_URL`) | 01, 02 | Deployed backend Container App URL (`azd env get-value AGENT_SERVICE_URL`). |
| `OBO_USER_TOKEN` | 01 | A fresh SPA-issued user access token, `aud = api://<server>/access_as_user`. Acquire from the signed-in frontend (DevTools → the `mcpAccessTokens` value on a chat request), or use 03 instead. |
| `OBO_MCP_URL` | 02 (server-level) | Direct MCP endpoint `https://<fqdn>/mcp` (`azd env get-value OBO_MCP_SERVER_MCP_URL`). Enables the no-bearer / wrong-client rejection test. |
| `OBO_SERVER_IDENTIFIER_URI` | 02 (optional) | Server app identifier URI for the wrong-client token resource (`azd env get-value OBO_SERVER_APP_IDENTIFIER_URI`). Defaults to the MCP origin. |
| `KRATOS_FRONTEND_URL` (or `OBO_FRONTEND_URL`) | 03 | Deployed SWA URL. |
| `OBO_BROWSER` | 03 | Set to `1` to run the CDP browser proof (otherwise skipped). |
| `OBO_CDP_URL` | 03 | CDP endpoint of a running Edge/Chromium. Default `http://localhost:9222`. |
| `OBO_MCP_SERVER_NAME` | all | Key the token is attached under. Default `graph-obo`. |
| `OBO_USE_CASE` | 01, 02 | Persona/use-case for the chat. Default `generic`. |
| `CHAT_TIMEOUT_MS` | all | Per chat round-trip ceiling. Default `90000`. |

Capture the deployed values quickly:

```bash
azd env get-value AGENT_SERVICE_URL          # -> KRATOS_BACKEND_URL
azd env get-value KRATOS_FRONTEND_URL         # -> KRATOS_FRONTEND_URL (or SWA output)
azd env get-value OBO_MCP_SERVER_MCP_URL      # -> OBO_MCP_URL
azd env get-value OBO_SERVER_APP_IDENTIFIER_URI
```

## Run it

```bash
cd .copilot/skills/obo-identity-proof

# Core binding proof (operator supplies a fresh SPA user token):
KRATOS_BACKEND_URL=https://<backend> OBO_USER_TOKEN=<jwt> ./run.sh --grep "identity binding"

# Add the non-spoofable / server-level negative checks:
KRATOS_BACKEND_URL=https://<backend> OBO_MCP_URL=https://<fqdn>/mcp ./run.sh --grep "negative"

# Full authentic proof through a real signed-in Edge over CDP (no hand-fed token):
OBO_BROWSER=1 KRATOS_FRONTEND_URL=https://<swa> OBO_CDP_URL=http://localhost:9222 \
  ./run.sh --grep "browser proof"

# Everything that has inputs configured:
KRATOS_BACKEND_URL=... KRATOS_FRONTEND_URL=... OBO_MCP_URL=... OBO_USER_TOKEN=... ./run.sh
```

`run.sh` installs npm deps on first run, and Chromium only when `OBO_BROWSER=1`.
Extra args are forwarded to `playwright test`. Reports land in
`playwright-report/` and `test-results/` (gitignored).

## How the binding is proved (mechanics)

1. Frontend MSAL acquires a token for `api://<server>/access_as_user` and sends
   it in the chat **body** under `mcpAccessTokens["graph-obo"]` — never a header,
   never prompt text.
2. The backend is a dumb pass-through; the hosted agent injects the token **only**
   as the MCP server's `Authorization` header (never model-visible, never logged).
3. The MCP server validates the token (audience + allowed client), exchanges it
   On-Behalf-Of for a Graph token, and calls `/me`.
4. `get_my_profile` returns `{ displayName, userPrincipalName, mail, jobTitle,
   officeLocation, id }`. `id == token.oid` is the binding the specs assert.

## Conventions

- TypeScript Playwright with `@playwright/test`; one spec = one proof level.
- Specs **self-skip** when their inputs are unset, so the suite is safe to run
  with only some env configured.
- Assertions are content-aware (oid equality, UPN presence) and include
  non-leak checks (the raw bearer must never appear in the transcript or page).

## Known limitations

- 01 needs a **fresh** `OBO_USER_TOKEN` (access tokens expire ~60–90 min). If it
  401s, re-acquire from the signed-in frontend or use 03.
- 03 expects the operator to complete interactive MSAL/MFA in the CDP-attached
  Edge; it waits up to 120s for a signed-in state.
- Foundry cold-start can exceed the default timeout on the first call after
  idle; each chat spec warms up once — bump `CHAT_TIMEOUT_MS` for colder envs.
