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
Azure Container Apps ── Agent Service (Python)
 ├── FastAPI + SSE Streaming
 ├── Copilot SDK / Agentic Loop
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
1. Provision all Azure infrastructure via Bicep
2. Build the Docker container image
3. Push to Azure Container Registry
4. Deploy agent service to Container Apps
5. Deploy frontend to Static Web Apps
6. Configure all Managed Identity connections
7. Output the public URL

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
│   ├── code-interpreter/
│   └── foundry-agent/
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
| **Foundry Agent** | Delegate to Foundry sub-agents (eval, safety) |

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
- Logged events: user messages, agentic loop iterations, skill invocations, LLM calls, context compaction, errors
- Per-skill metrics: call count, latency, error rate
- Token consumption tracking per model

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
| Cosmos DB (serverless) | $5 – $25 |
| AI Search (basic) | ~$75 |
| Key Vault | ~$1 |
| Container Registry (basic) | ~$5 |
| Application Insights | $5 – $20 |
| Foundry Models (per-token) | Variable |
| **Total baseline** | **~$90 – $175/month** |

---

## License

MIT
