# Kratos Agent — Solution Accelerator

> **One-click deployable reference architecture for building extensible AI agents on Azure.**

Enterprise-grade agentic AI application powered by **GitHub Copilot SDK**, **Microsoft Foundry**, and the **MCP Skills Protocol**.

**Authors:** Farid, Riccardo, Chris, Fabrizio, Konstantinos

---

## Architecture

```
User
 │  HTTPS
 ▼
Static Web Apps ── Chat UI (Next.js)
 │  REST / SSE
 ▼
API Management ── AI Gateway (BasicV2)
 │  Foundry Traces + AppInsights logger
 ▼
Azure Container Apps ── Agent Service (Python)
 ├── FastAPI + SSE Streaming
 ├── Copilot SDK / Agentic Loop
 ├── OpenTelemetry (GenAI semantic conventions)
 └── Skill Router / MCP Protocol
         │         │         │
        MCP       API       SDK
         ▼         ▼         ▼
   MCP Skills   Microsoft Foundry       Platform Services
   ──────────   ─────────────────       ─────────────────
   Web Search   Models (GPT-4o/GPT-5)   Cosmos DB
   RAG Search   Evaluation              AI Search
   Code Interp. Guardrails              Key Vault
   Custom       Responsible AI          App Insights
```

### Core Pillars

| Pillar | Platform | Role |
|--------|----------|------|
| **The Engine** | GitHub Copilot SDK | Agentic loop (Plan → Act → Observe → Iterate) |
| **The Platform** | Microsoft Foundry | Enterprise model hosting, evaluation, guardrails |
| **The Extensibility** | MCP Skills Protocol | Portable, standard tool interface |

---

## Quick Start

### Prerequisites
- [Azure Developer CLI (azd)](https://learn.microsoft.com/azure/developer/azure-developer-cli/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/)
- [Docker](https://www.docker.com/)
- [Node.js 20+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)

### Deploy to Azure (One Command)

```bash
# Clone the repo
git clone https://github.com/kmavrodis/kratos-agent
cd kratos-agent

# Provision + Build + Deploy everything
azd up
```

`azd up` will:
1. Provision all Azure infrastructure via Bicep (including the AI Gateway / APIM)
2. Build the Docker container image
3. Push to Azure Container Registry
4. Deploy agent service to Container Apps
5. Deploy frontend to Static Web Apps (configured to route through the AI Gateway)
6. Configure all Managed Identity connections
7. Output the public URL

### Register the Agent in Microsoft Foundry (Manual Step)

After `azd up` completes, you must register the agent in the **Foundry portal** so that Foundry recognizes it and populates the Traces tab:

1. Open [Microsoft Foundry](https://ai.azure.com) and navigate to your project
2. Go to **Operate** → **Agents**
3. Click **+ Register agent** (Custom Agent)
4. Fill in:
   - **Name**: `kratos-agent` (or your preferred display name)
   - **Gateway**: Select the APIM gateway provisioned by Bicep (e.g. `oai-xxx-gateway`)
   - **Backend URL**: The Container App URL (visible in the `AGENT_SERVICE_DIRECT_URL` output from `azd`)
   - **API path**: `kratos-agent` (must match the `agentApiPath` Bicep parameter)
5. Complete the wizard — Foundry will create an API on the gateway pointing to your Container App

This is the **only manual step**. It cannot be automated via Bicep because the Foundry Control Plane creates internal metadata that links the APIM API to the agent tracing pipeline.

> **Tip:** Run `azd env get-values | grep AGENT_SERVICE` to see both the direct Container App URL and the gateway URL.

### Local Development

```bash
# Backend
cd src/backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd src/frontend
npm install
npm run dev
```

---

## Run locally without Azure

You can run the full backend + frontend on your laptop with **zero Azure services**. A GitHub Copilot token replaces Microsoft Foundry, a SQLite file replaces Cosmos DB, and [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) replaces Blob Storage. `LOCAL_MODE` auto-enables whenever `COSMOS_DB_ENDPOINT` is empty, so the same codebase works in both environments without edits.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — runs the `azurite` + `backend` containers.
- A **GitHub Copilot token** with the `Copilot` scope — create one at [github.com/settings/tokens](https://github.com/settings/tokens).
- [Node.js 20+](https://nodejs.org/) — only if you want to run the frontend locally (it is not containerised).

### Quick start

```bash
cp .env.local.example .env.local
# Edit .env.local: set COPILOT_GITHUB_TOKEN=ghu_xxx
./run-local.sh          # or .\run-local.ps1 on Windows
```

The helper scripts copy the env file and run `docker compose up --build`. If you prefer, you can skip them and run `docker compose up --build` directly.

### What the helper starts

| Service | URL | Purpose |
|---|---|---|
| backend | http://localhost:8000 | FastAPI + Copilot SDK |
| azurite | http://localhost:10000 | Local Blob (skills + apm manifests) |
| *(frontend, optional)* | http://localhost:3000 | `cd src/frontend && npm install && npm run dev` |

### Data locations

Everything persists on the host so restarts are cheap:

- `.local/backend/kratos.db` — SQLite file with conversations, messages, settings, and session mappings.
- `.local/azurite/` — emulated blob account (skill blobs + APM manifests).
- `use-cases/` is bind-mounted into the backend container — edits on the host show up immediately.

### Switching between local and Azure modes

Auto-detection uses `COSMOS_DB_ENDPOINT` as the switch:

- **Local:** leave `COSMOS_DB_ENDPOINT` empty (or set `LOCAL_MODE=true`).
- **Azure:** set `LOCAL_MODE=false` (or just remove it) and populate `COSMOS_DB_ENDPOINT`, `FOUNDRY_ENDPOINT`, and `BLOB_STORAGE_ENDPOINT`.

### What still works

- **APM** (`apm install`, admin API) — uses git + outbound HTTPS, nothing Azure.
- **MCP servers** configured via `use-cases/{uc}/.mcp.json`.
- **Skill enable/disable** and `SKILL.md` edits via `/api/admin/skills/*`.

### Limitations

- **App Insights / Foundry Traces** are disabled — telemetry still runs locally via the OTel console exporter.
- **No Foundry guardrails** — the GitHub Copilot endpoint handles safety instead.
- **Private git hosts for APM** still require credentials baked into the image (follow-up).

---

## Project Structure

```
kratos-agent/
├── azure.yaml                  # Azure Developer CLI config
├── skills.yaml                 # MCP skill registry
│
├── infra/                      # Azure Bicep templates
│   ├── main.bicep              # Orchestrator
│   ├── main.parameters.json
│   └── modules/
│       ├── network.bicep       # VNet + subnets
│       ├── cosmos-db.bicep     # Serverless Cosmos DB
│       ├── ai-search.bicep     # AI Search (Basic)
│       ├── ai-gateway.bicep    # API Management (AI Gateway + AppInsights diagnostic)
│       ├── key-vault.bicep     # Key Vault + private endpoint
│       ├── container-registry.bicep
│       ├── container-apps-env.bicep
│       ├── agent-service.bicep # Container App
│       ├── static-web-app.bicep
│       ├── app-insights.bicep
│       ├── log-analytics.bicep
│       └── role-assignments.bicep
│
├── src/
│   ├── backend/                # Python agent service
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── app/
│   │   │   ├── main.py         # FastAPI entry point
│   │   │   ├── config.py       # Settings (env vars)
│   │   │   ├── models.py       # Pydantic schemas
│   │   │   ├── observability.py # OpenTelemetry setup
│   │   │   ├── routers/
│   │   │   │   ├── health.py
│   │   │   │   ├── conversations.py
│   │   │   │   └── agent.py    # SSE streaming endpoint
│   │   │   └── services/
│   │   │       ├── agent_loop.py     # The agentic loop
│   │   │       ├── cosmos_service.py # Cosmos DB persistence
│   │   │       └── skill_registry.py # MCP skill registry
│   │   └── tests/
│   │
│   └── frontend/               # Next.js chat UI
│       ├── package.json
│       ├── next.config.js
│       └── src/
│           ├── app/            # Pages
│           ├── components/     # React components
│           ├── lib/            # API client
│           └── types/          # TypeScript types
│
├── skills/                     # Built-in MCP skills
│   ├── web-search/
│   ├── rag-search/
│   └── code-interpreter/
│
└── .github/
    └── workflows/
        └── ci-cd.yml           # Full CI/CD pipeline
```

---

## Skills (MCP Protocol)

### Built-in Skills

| Skill | Description |
|-------|-------------|
| **Web Search** | Real-time internet search via Bing API |
| **RAG Search** | Azure AI Search knowledge base retrieval |
| **Code Interpreter** | Sandboxed Python execution |

### Adding a Custom Skill

**Step 1** — Create the skill directory:

```
skills/my-skill/
  SKILL.md          # Metadata + instructions
  scripts/
    handler.py      # Executable logic
```

**Step 2** — Register in `skills.yaml`:

```yaml
skills:
  - name: my-skill
    description: What my skill does
    enabled: true
    path: ./skills/my-skill
```

**Step 3** — Deploy:

```bash
azd deploy agent-service
```

No changes to core agent code required.

### Progressive Disclosure Model

| Stage | What Loads | Tokens Used |
|-------|-----------|-------------|
| 1 — DISCOVER | `name` + `description` | ~50 tokens |
| 2 — LOAD | Full `## Instructions` from SKILL.md | Variable |
| 3 — EXECUTE | Scripts run on demand; results flow into the loop | Runtime only |

---

## APM (Agent Package Manager)

[APM (microsoft/apm)](https://microsoft.github.io/apm/) is a dependency manager for AI-agent primitives — skills, prompts, instructions, agents, MCP servers and plugins — conceptually a `package.json` for agents. Kratos embeds the `apm` CLI in the backend image so each use-case can pull versioned **remote** plugins (GitHub, GitLab, Azure DevOps …) alongside its blob-authored local skills.

### How it works in kratos-agent

- Each use-case has its own manifest at `use-cases/{name}/apm.yml` declaring remote deps + a committed `apm.lock.yaml`.
- Admins add/remove plugins at runtime via the admin API (see snippets below) — no redeploy needed.
- `apm install` materialises packages into `use-cases/{name}/apm_modules/` and, with `--target copilot`, deploys skills into `use-cases/{name}/.github/skills/`, which the `SkillRegistry` merges on top of local skills.
- **Local skills always win on name conflict.** Blob-authored `skills/` stay as today; APM manages only remote deps.

### Real working remote sources

| Source | APM reference | What it provides |
|---|---|---|
| `microsoft/apm-sample-package` | `microsoft/apm-sample-package#v1.0.0` | Reference APM package — design instructions + prompts |
| `anthropics/skills` | `anthropics/skills/skills/frontend-design` | Claude Skill for frontend design review (virtual subdirectory) |
| `github/awesome-copilot` | `github/awesome-copilot/plugins/context-engineering` | Copilot plugin for context engineering |
| `microsoft/GitHub-Copilot-for-Azure` | `microsoft/GitHub-Copilot-for-Azure/plugin/skills/azure-compliance` | Azure compliance skill (virtual subdirectory) |

Example `use-cases/generic/apm.yml`:

```yaml
name: kratos-generic
version: 1.0.0
description: Kratos agent — generic use-case APM manifest
target: copilot
dependencies:
  apm:
    - microsoft/apm-sample-package#v1.0.0
    - anthropics/skills/skills/frontend-design
    - github/awesome-copilot/plugins/context-engineering
    - microsoft/GitHub-Copilot-for-Azure/plugin/skills/azure-compliance
  mcp: []
```

Runtime admin API:

```bash
# Install a remote APM plugin at runtime (admin API)
curl -X POST https://<agent-service>/admin/use-cases/generic/apm/install \
  -H "Content-Type: application/json" \
  -d '{"package": "anthropics/skills/skills/frontend-design"}'

# Force a full resync from apm.yml
curl -X POST https://<agent-service>/admin/use-cases/generic/apm/sync
```

Admin endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/use-cases/{uc}/apm` | List dependencies + lockfile state |
| `POST` | `/admin/use-cases/{uc}/apm/install` | Install a package (`{package, ref?}`) |
| `DELETE` | `/admin/use-cases/{uc}/apm/{package}` | Uninstall a package |
| `POST` | `/admin/use-cases/{uc}/apm/sync` | Run `apm install` from the current manifest |
| `POST` | `/admin/use-cases/{uc}/apm/update` | Update lockfile to latest refs |

### CLI usage inside the container

The `apm` binary is baked into the backend image for debugging. Exec into the Container App and run it from a use-case directory:

```bash
cd /app/use-cases/generic
apm list
apm install microsoft/apm-sample-package#v1.0.0
```

### Supply-chain & security

`apm install` runs a content audit (hidden Unicode detection, known-bad package hashes) before materialising any files, and the diagnostic summary is surfaced in the admin API response. Only public git hosts are supported today — **private repositories are a known follow-up** and require provisioning git credentials into the backend image.

---

## Security

- **Zero secrets in code** — All secrets in Azure Key Vault via Managed Identity
- **Passwordless auth** — Managed Identity for service-to-service, Entra ID for users
- **Network isolation** — VNet integration, private endpoints for Cosmos DB, Key Vault, AI Search
- **Content safety** — Foundry guardrails (prompt shields, PII redaction, jailbreak detection)
- **RBAC everywhere** — Least privilege role assignments for every service identity

---

## Observability

- **OpenTelemetry** instrumentation across the entire request path
- **Azure Application Insights** for traces, metrics, and logs
- **Microsoft Foundry Traces** — end-to-end agent trace visibility in the Foundry portal
- Logged events: user messages, agentic loop iterations, skill invocations, LLM calls, context compaction, errors
- Per-skill metrics: call count, latency, error rate
- Token consumption tracking per model

### Foundry Tracing

All frontend traffic flows through the **AI Gateway (APIM)**, which feeds request telemetry to Application Insights. The Foundry Traces tab reads from AppInsights to display agent execution traces.

The backend emits OpenTelemetry spans following the [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/):

| Span | Attributes |
|------|------------|
| `create_agent` | `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.version` |
| `invoke_agent` | `gen_ai.conversation.id`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.agent.tool_calls`, `gen_ai.client.time_to_first_token_ms` |

The APIM gateway is configured with an **Application Insights logger** and **diagnostic** at 100% sampling, which is required for Foundry Traces to work.

### AI Gateway (API Management)

The AI Gateway is provisioned by Bicep (`infra/modules/ai-gateway.bicep`) with:
- **BasicV2 SKU** for AI workloads
- **AppInsights logger** connected to the project's Application Insights instance
- **`applicationinsights` diagnostic** with 100% fixed sampling
- The frontend's `config.json` is injected at deploy time with the gateway URL, so all user traffic routes through APIM

---

## CI/CD Pipeline

Push to `main` triggers the full pipeline:

| Stage | What Runs |
|-------|----------|
| Lint & Static Analysis | Ruff, MyPy, ESLint |
| Unit Tests | pytest with coverage |
| Build | Docker image + Next.js static export |
| Deploy (staging) | `azd deploy` to staging |
| Integration Tests | End-to-end tests against staging |
| Deploy (production) | `azd deploy` to production (gated) |

---

## Cost Baseline

| Service | Monthly Cost |
|---------|-------------|
| Container Apps (consumption) | $0 – $50 |
| Static Web Apps (free) | $0 |
| API Management (BasicV2) | ~$175 |
| Cosmos DB (serverless) | $5 – $25 |
| AI Search (basic) | ~$75 |
| Key Vault | ~$1 |
| Container Registry (basic) | ~$5 |
| Application Insights | $5 – $20 |
| Foundry Models (per-token) | Variable |
| **Total baseline** | **~$265 – $350/month** |

---

## License

MIT
