# e2e-smoke — Playwright-driven live smoke tests for kratos-agent

A repo-local Playwright skill that exercises a deployed kratos-agent
environment end-to-end: frontend renders, backend /health, scenarios
load per use-case, chat round-trips, evals API, and traces API.

## When to use

- After every `azd deploy backend` / `azd deploy hosted-agent` / `azd deploy web`
  to confirm the deployment is healthy from a real client.
- Before opening a PR that touches `src/backend`, `src/frontend`, `src/hosted-agent`,
  or the eval / traces surface.
- After granting / changing Foundry RBAC, to confirm the hosted agent and the
  agent-service can still talk to the model.
- In CI as the post-deploy gate (recommended).

## When NOT to use

- Local-only frontend dev work — `next dev` + targeted manual click is faster.
- Pure backend unit changes — prefer `uv run pytest` in `src/backend`.
- Static type / lint checks — those have their own runners.

## What it tests

| Spec | Surface | Asserts |
|------|---------|---------|
| `01-health.spec.ts` | API + SWA | `/health` 200, frontend HTML serves, runtime `config.json` points at expected backend |
| `02-scenarios.spec.ts` | `/api/use-cases/{uc}/evals/scenarios` | Every use-case returns ≥1 scenario; required shape (`name`, `prompt`, `expected_signal_keywords`) |
| `03-chat.spec.ts` | `/api/agent/chat` SSE | Sends a tiny prompt, asserts a non-empty assistant response inside `CHAT_TIMEOUT_MS` |
| `04-evals.spec.ts` | `/api/use-cases/{uc}/evals/runs` | At least one completed validation run exists; per-run detail returns scenarios array |
| `05-traces.spec.ts` | `/api/traces/operations` | ≥1 operation in lookback window; per-operation detail returns spans |
| `06-ui.spec.ts` | browser | Frontend loads, use-case picker is interactive, EvalsAdminPanel + TracesAdminPanel tabs render without JS errors |

## Inputs (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `KRATOS_FRONTEND_URL` | `https://mango-bay-04ed10b03.7.azurestaticapps.net` | SWA URL |
| `KRATOS_BACKEND_URL` | `https://ca-agent-jep3w6qugjoda.blacktree-6e513e92.swedencentral.azurecontainerapps.io` | Container Apps URL |
| `KRATOS_USE_CASES` | `generic,insurance,retail-banking,wealth-management,sales-account-review` | Comma-separated |
| `CHAT_TIMEOUT_MS` | `60000` | Chat round-trip ceiling |
| `TRACES_LOOKBACK_HOURS` | `6` | App Insights query window |
| `SKIP_BROWSER` | unset | Set to `1` to skip browser tests (CI / no-chromium hosts) |

The defaults match the **fruocco-2** deployment used by the current pilot;
point `KRATOS_*_URL` at a different env to retarget.

## Run it

```bash
cd .copilot/skills/e2e-smoke
./run.sh                                  # install (first run) + run all specs
./run.sh --grep "chat"                    # filter
KRATOS_BACKEND_URL=... ./run.sh           # different env
SKIP_BROWSER=1 ./run.sh                   # API-only mode
```

The wrapper installs `npm` deps + Chromium on first run only (cached in
`node_modules/` + the playwright user dir). Results land in
`playwright-report/` and `test-results/` — both gitignored.

## Conventions

- TypeScript Playwright with `@playwright/test`.
- One spec = one concern; specs are independent (no shared fixture state) so
  Playwright's `fullyParallel: true` works.
- Assertions are content-aware: `/health` checks the actual JSON shape, not
  just status code. Chat assertion requires non-empty body, not just 200.
- Browser tests are gated on `SKIP_BROWSER` for CI on hosts without Chromium.
- Auth is assumed off (`admin_auth_enabled=false` on the deployment); add
  Easy Auth bearer logic here when that changes.

## Known limitations

- Foundry agent cold-start can spike `/api/agent/chat` above 60s on the
  very first call after 15 min idle. The spec already retries once with
  a 30 s warmup ping; bump `CHAT_TIMEOUT_MS` if your environment is colder.
- Traces lookback default is 2h to match the typical pilot session; the
  test gracefully skips assertions if zero operations exist in that
  window (so it doesn't false-fail before any real chat has happened).
