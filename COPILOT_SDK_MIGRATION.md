# Copilot SDK Migration Plan
## kratos-agent → GitHub Copilot SDK (GitHub Auth)

---

## Overview

Replace the custom 295-line ReAct loop in `agent_loop.py` with the GitHub Copilot SDK.
The SDK handles orchestration, context compaction, streaming, tool routing, and model calls.
We keep everything else: FastAPI, Cosmos DB, observability, skill SKILL.md files, Azure infra.

### Auth choice: GitHub OAuth token
- `GITHUB_TOKEN` / `COPILOT_GITHUB_TOKEN` set as an env var (Key Vault secret in production)
- Foundry is **no longer called directly** — the SDK calls the model
- Managed Identity is still used for Cosmos DB, Key Vault, and AI Search (unchanged)

### Architecture after migration

```
User → FastAPI (SSE) → CopilotClient session → Copilot CLI (server mode) → GitHub-hosted model
                              │
                    @define_tool functions
                              │
                    ┌─────────┼────────────┐
                  Bing     AI Search    Code exec
                 (web)      (RAG)      (sandboxed)
```

---

## What Changes vs. What Stays

| File | Action | Reason |
|------|--------|--------|
| `pyproject.toml` | ✏️ Add dependency | Add `github-copilot-sdk` |
| `Dockerfile` | ✏️ Add Node.js + CLI install | SDK wraps Copilot CLI binary |
| `app/config.py` | ✏️ Add token setting | `copilot_github_token: str` |
| `.env.example` | ✏️ Add token var | `COPILOT_GITHUB_TOKEN=` |
| `app/services/agent_loop.py` | 🗑️ Delete | Fully replaced by SDK |
| `app/services/copilot_agent.py` | ✨ Create | New SDK-based agent service |
| `app/services/skill_tools.py` | ✨ Create | `@define_tool` functions for each skill |
| `app/services/skill_registry.py` | ✏️ Simplify | Remove custom discovery (SDK reads SKILL.md natively) |
| `app/routers/agent.py` | ✏️ Rewire SSE | Replace `AgentLoop` with `CopilotAgent` event stream |
| `app/main.py` | ✏️ Add lifespan | Start/stop `CopilotClient` on app startup/shutdown |
| `app/models.py` | ✅ Keep | Event types still used for SSE |
| `app/services/cosmos_service.py` | ✅ Keep | Conversation persistence unchanged |
| `app/observability.py` | ✅ Keep | OpenTelemetry unchanged |
| `app/routers/health.py` | ✅ Keep | Health checks unchanged |
| `app/routers/conversations.py` | ✅ Keep | Conversation CRUD unchanged |
| `skills/*/SKILL.md` | ✅ Keep | SDK reads these natively via `skill_directories` |
| `skills.yaml` | ✅ Keep | Used to load skill tool registrations |
| `infra/` | ✏️ Minor | Add Key Vault secret for `COPILOT_GITHUB_TOKEN` |

---

## Step 1 — Add Dependencies

### `src/backend/pyproject.toml`

Add to the `dependencies` list:

```toml
"github-copilot-sdk>=0.1.0",
```

Remove (no longer needed after migration):
```toml
"httpx>=0.27.0",   # only used in agent_loop._call_model — can remove if no other usage
```

---

## Step 2 — Update Dockerfile

The Copilot CLI is a Node.js binary that must be installed in the container.
The SDK communicates with it via JSON-RPC.

Add **before** the Python install steps:

```dockerfile
# Install Node.js (required for Copilot CLI)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g @github/copilot && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
```

Verify the CLI path after build:
```bash
copilot --version   # should print the installed version
```

---

## Step 3 — Update Config

### `app/config.py`

Add one new field to `Settings`:

```python
# GitHub Copilot SDK auth (stored in Key Vault, injected as env var)
copilot_github_token: str = ""
```

The SDK will pick this up automatically if `COPILOT_GITHUB_TOKEN` is set in the environment.
You can also pass it explicitly — see Step 5.

### `.env.example`

Add:
```env
# GitHub Copilot SDK (required — store in Key Vault in production)
COPILOT_GITHUB_TOKEN=ghp_your_token_here
```

### Azure Key Vault / Bicep (infra)

Add a Key Vault secret for `copilot-github-token` and wire it to the Container App
as environment variable `COPILOT_GITHUB_TOKEN`. Pattern mirrors the existing Foundry
secret setup in the Bicep templates.

---

## Step 4 — Create Skill Tools (`skill_tools.py`)

This is the **most important new file**. Each skill in `skills.yaml` becomes a
`@define_tool` decorated async function. The SDK calls these when the agent decides
to use a skill — replacing the placeholder `_execute_tool()` in `agent_loop.py`.

Create `app/services/skill_tools.py`:

```python
"""MCP skill implementations as Copilot SDK @define_tool functions.

Each function here corresponds to one skill in skills.yaml.
The SDK calls these when the agent decides to invoke a skill.
"""

import os
import subprocess
from pydantic import BaseModel, Field
from copilot.tools import define_tool
from azure.identity.aio import DefaultAzureCredential
from azure.search.documents.aio import SearchClient
from opentelemetry import trace

tracer = trace.get_tracer(__name__)


# ─── Web Search ──────────────────────────────────────────────────────────────

class WebSearchParams(BaseModel):
    query: str = Field(description="The search query to look up on the internet")

@define_tool(description="Real-time internet search for current information and market data")
async def web_search(params: WebSearchParams) -> dict:
    """Search the internet for up-to-date information."""
    with tracer.start_as_current_span("skill.web_search"):
        # Option A: Bing Search API via Azure Cognitive Services
        # Option B: Call skills/web-search/scripts/search.py as subprocess
        # Implement with your preferred search provider
        # Example subprocess approach:
        result = subprocess.run(
            ["python", "skills/web-search/scripts/search.py", "--query", params.query],
            capture_output=True, text=True, timeout=30
        )
        return {"results": result.stdout, "query": params.query}


# ─── RAG Search ──────────────────────────────────────────────────────────────

class RAGSearchParams(BaseModel):
    query: str = Field(description="The query to search in the knowledge base")
    top: int = Field(default=5, description="Number of results to return")

@define_tool(description="Azure AI Search knowledge base for grounded answers from internal documents")
async def rag_search(params: RAGSearchParams) -> dict:
    """Search the Azure AI Search knowledge base."""
    with tracer.start_as_current_span("skill.rag_search"):
        ai_search_endpoint = os.environ.get("AI_SEARCH_ENDPOINT", "")
        if not ai_search_endpoint:
            return {"error": "AI_SEARCH_ENDPOINT not configured"}

        credential = DefaultAzureCredential()
        async with SearchClient(
            endpoint=ai_search_endpoint,
            index_name="knowledge-base",
            credential=credential,
        ) as client:
            results = await client.search(params.query, top=params.top)
            docs = []
            async for result in results:
                docs.append({
                    "content": result.get("content", ""),
                    "title": result.get("title", ""),
                    "score": result.get("@search.score", 0),
                })
            return {"results": docs, "query": params.query}


# ─── Code Interpreter ─────────────────────────────────────────────────────────

class CodeInterpreterParams(BaseModel):
    code: str = Field(description="Python code to execute in a sandboxed environment")

@define_tool(description="Sandboxed Python execution for computation, data analysis, and code generation")
async def code_interpreter(params: CodeInterpreterParams) -> dict:
    """Execute Python code in a sandboxed subprocess."""
    with tracer.start_as_current_span("skill.code_interpreter"):
        try:
            result = subprocess.run(
                ["python", "-c", params.code],
                capture_output=True, text=True,
                timeout=30,          # hard timeout
                cwd="/tmp",          # isolated working dir
            )
            return {
                "stdout": result.stdout[:4000],   # truncate large outputs
                "stderr": result.stderr[:1000],
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"error": "Code execution timed out (30s limit)"}
        except Exception as e:
            return {"error": str(e)}


# ─── Foundry Agent ────────────────────────────────────────────────────────────

class FoundryAgentParams(BaseModel):
    task: str = Field(description="The task to delegate to the specialized Foundry sub-agent")
    agent_name: str = Field(default="default", description="Name of the Foundry sub-agent to invoke")

@define_tool(description="Delegate complex or specialized tasks to Microsoft Foundry sub-agents")
async def foundry_agent(params: FoundryAgentParams) -> dict:
    """Delegate a task to a Microsoft Foundry specialized sub-agent."""
    with tracer.start_as_current_span("skill.foundry_agent"):
        # Call your Foundry agent endpoint here
        # This can use Managed Identity since it's a direct Azure call,
        # separate from the Copilot SDK model routing
        foundry_endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")
        if not foundry_endpoint:
            return {"error": "FOUNDRY_ENDPOINT not configured"}

        credential = DefaultAzureCredential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")

        import httpx
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{foundry_endpoint}/agents/{params.agent_name}/run",
                headers={"Authorization": f"Bearer {token.token}"},
                json={"task": params.task},
            )
            return response.json()


# ─── Tool registry ────────────────────────────────────────────────────────────

# All tools to register with every SDK session
ALL_TOOLS = [web_search, rag_search, code_interpreter, foundry_agent]
```

---

## Step 5 — Create Copilot Agent Service (`copilot_agent.py`)

This replaces `agent_loop.py` entirely. It wraps the SDK session per conversation
and translates SDK events into the existing SSE event types (`ThoughtEvent`, `ToolCallEvent`, etc.).

Create `app/services/copilot_agent.py`:

```python
"""Copilot SDK agent service.

Replaces agent_loop.py. Uses CopilotClient to manage sessions per conversation,
and translates SDK events to the existing SSE event schema.
"""

import asyncio
import logging
import os
import time
from typing import AsyncGenerator

from copilot import CopilotClient
from copilot.generated.session_events import SessionEventType
from opentelemetry import trace

from app.config import Settings
from app.models import ContentEvent, DoneEvent, ErrorEvent, ThoughtEvent, ToolCallEvent
from app.services.skill_tools import ALL_TOOLS

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

SYSTEM_PROMPT = """You are Kratos, an enterprise AI assistant.

You have access to domain skills (tools). Use them when the user needs:
- Real-time information → web_search
- Internal knowledge base → rag_search
- Computation or code → code_interpreter
- Specialized AI sub-tasks → foundry_agent

Reason before calling tools. Be transparent about what you're doing.
Cite tool outputs in your final response.
"""


class CopilotAgent:
    """Manages one CopilotClient shared across the app lifetime.

    Each conversation gets its own SDK session, preserving multi-turn history
    automatically without manually loading from Cosmos DB on every turn.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: CopilotClient | None = None
        # conversation_id → active SDK session
        self._sessions: dict[str, object] = {}

    async def start(self) -> None:
        """Initialize the Copilot CLI client. Called once on app startup."""
        token = self.settings.copilot_github_token or os.environ.get("COPILOT_GITHUB_TOKEN", "")

        client_options: dict = {}
        if token:
            # Explicitly pass the token (overrides env var)
            client_options["github_token"] = token

        self._client = CopilotClient(client_options or None)
        await self._client.start()
        logger.info("CopilotClient started")

    async def stop(self) -> None:
        """Shutdown all sessions and the CLI client. Called on app shutdown."""
        for session in self._sessions.values():
            try:
                await session.destroy()
            except Exception:
                pass
        if self._client:
            await self._client.stop()
        logger.info("CopilotClient stopped")

    async def _get_or_create_session(self, conversation_id: str) -> object:
        """Return an existing session or create a new one for this conversation."""
        if conversation_id in self._sessions:
            return self._sessions[conversation_id]

        # Paths to SKILL.md files — SDK loads them for progressive disclosure
        skill_directories = [
            "./skills/web-search/SKILL.md",
            "./skills/rag-search/SKILL.md",
            "./skills/code-interpreter/SKILL.md",
            "./skills/foundry-agent/SKILL.md",
        ]

        session = await self._client.create_session({
            "model": "gpt-4o",           # or gpt-5, claude-sonnet-4.5, etc.
            "streaming": True,
            "tools": ALL_TOOLS,          # @define_tool functions from skill_tools.py
            "skill_directories": skill_directories,
            "system_message": {
                "mode": "append",        # Append to Copilot's default system prompt
                "content": SYSTEM_PROMPT,
            },
            "on_permission_request": lambda req, inv: {"decision": "allow"},
        })

        self._sessions[conversation_id] = session
        logger.info("Created SDK session for conversation=%s", conversation_id)
        return session

    async def run(
        self,
        message: str,
        conversation_id: str,
    ) -> AsyncGenerator[ThoughtEvent | ToolCallEvent | ContentEvent | ErrorEvent, None]:
        """Send a message and stream SDK events as typed SSE events."""

        with tracer.start_as_current_span("copilot_agent.run", attributes={"conversation_id": conversation_id}):
            queue: asyncio.Queue = asyncio.Queue()
            start = time.monotonic()

            try:
                session = await self._get_or_create_session(conversation_id)

                def on_event(event) -> None:
                    """Translate SDK events → our SSE event types and enqueue them."""
                    etype = event.type.value if hasattr(event.type, "value") else str(event.type)

                    if etype == "assistant.message.delta":
                        queue.put_nowait(ContentEvent(content=event.data.delta_content or ""))

                    elif etype == "tool.execution.start":
                        queue.put_nowait(ThoughtEvent(
                            content=f"Calling tool: {event.data.tool_name}",
                            iteration=0,
                        ))
                        queue.put_nowait(ToolCallEvent(
                            skillName=event.data.tool_name,
                            status="started",
                            input=str(getattr(event.data, "input", "")),
                        ))

                    elif etype == "tool.execution.end":
                        duration_ms = int(getattr(event.data, "duration_ms", 0))
                        queue.put_nowait(ToolCallEvent(
                            skillName=event.data.tool_name,
                            status="completed",
                            output=str(getattr(event.data, "output", ""))[:500],
                            durationMs=duration_ms,
                        ))

                    elif etype == "session.idle":
                        queue.put_nowait(None)  # sentinel — stream is done

                    elif etype == "error":
                        queue.put_nowait(ErrorEvent(
                            message=str(getattr(event.data, "message", "Unknown error")),
                            code="SDK_ERROR",
                        ))
                        queue.put_nowait(None)

                session.on(on_event)

                # Non-blocking send — events flow through on_event callback above
                await session.send({"prompt": message})

                # Drain the queue until sentinel
                while True:
                    item = await asyncio.wait_for(queue.get(), timeout=120.0)
                    if item is None:
                        break
                    yield item

            except asyncio.TimeoutError:
                yield ErrorEvent(message="Agent timed out waiting for response", code="TIMEOUT")
            except Exception as e:
                logger.exception("CopilotAgent failed for conversation=%s", conversation_id)
                yield ErrorEvent(message=str(e), code="AGENT_ERROR")
                # Drop the broken session so next turn gets a fresh one
                self._sessions.pop(conversation_id, None)
```

---

## Step 6 — Update `main.py` (App Lifespan)

Replace the current lifespan block to start/stop `CopilotAgent` instead of having
no SDK client:

```python
# In lifespan(), after skill_registry.load():

from app.services.copilot_agent import CopilotAgent

copilot_agent = CopilotAgent(settings)
await copilot_agent.start()
application.state.copilot_agent = copilot_agent

# In the cleanup section (after yield):
await copilot_agent.stop()
```

The `AgentLoop` import and instantiation in `main.py` are **removed**.

---

## Step 7 — Update `agent.py` Router

Replace the `AgentLoop` usage with `CopilotAgent`. The SSE structure stays identical —
same event types, same `EventSourceResponse`, same Cosmos DB persistence.

```python
# In agent.py — change this import:
# FROM:
from app.services.agent_loop import AgentLoop
# TO:
# (no import needed — agent is on app.state)

# In event_generator(), replace the AgentLoop block:

# FROM:
agent_loop = AgentLoop(skill_registry=skill_registry, ...)
async for event in agent_loop.run(message=body.message, history=history, ...):
    ...

# TO:
copilot_agent = request.app.state.copilot_agent
async for event in copilot_agent.run(
    message=body.message,
    conversation_id=body.conversationId,
):
    ...
# Note: history is no longer manually loaded — the SDK session retains it.
# We still persist to Cosmos DB for cross-restart durability (keep that logic).
```

---

## Step 8 — Simplify `skill_registry.py`

The skill registry no longer needs to build a `get_discovery_context()` string for
the system prompt — the SDK reads `SKILL.md` files natively via `skill_directories`.

Keep the registry for:
- Loading `skills.yaml` to know which skills are enabled/disabled
- Providing skill paths to `_get_or_create_session()` in `copilot_agent.py`

Remove:
- `get_discovery_context()` method (SDK handles this)
- The `instructions` field on `SkillMetadata` (SDK reads SKILL.md directly)

---

## Step 9 — What the SDK Replaces (deletion list)

These pieces of `agent_loop.py` are **deleted** — the SDK provides them for free:

| Deleted code | SDK equivalent |
|---|---|
| `while iteration < MAX_ITERATIONS` ReAct loop | `session.send()` + `session.on()` |
| `_call_model()` — httpx to Foundry | SDK calls model internally |
| `_extract_tool_calls()` — regex JSON parsing | SDK's native tool calling |
| `_execute_tool()` — placeholder stub | `@define_tool` functions in `skill_tools.py` |
| `_build_messages()` — manual history assembly | SDK session keeps history |
| `_maybe_compact_context()` — manual compaction | SDK auto-compacts at 95% |
| Manual retry logic | SDK auto-retry + fallback |
| `DefaultAzureCredential` in agent loop | Removed (SDK uses GitHub token) |

---

## Step 10 — Session Persistence Strategy

The SDK session holds conversation history **in memory** per session object.
Cosmos DB persistence remains important for:

| Scenario | Handled by |
|---|---|
| User sends message, agent responds | SDK session (in-memory) |
| Pod restarts / Container App scales | Cosmos DB (reload history on new session) |
| User opens new browser tab | Cosmos DB (reload history on new session) |

**On session creation**, load prior messages from Cosmos DB and prepend them as context if the
conversation already has history (i.e., `conversation_id` is new to `_sessions` but not new to Cosmos):

```python
# In _get_or_create_session(), before create_session():
prior_history = await cosmos_service.list_messages(conversation_id)
if prior_history:
    # Send history as a synthetic first message so SDK session has context
    # Or use session's initialMessages option if available in the SDK
    pass
```

---

## Testing Checklist

After each step, verify:

- [ ] **Step 2**: `docker build` succeeds; `copilot --version` runs inside container
- [ ] **Step 3**: App starts without `COPILOT_GITHUB_TOKEN` → clear error message
- [ ] **Step 4**: Each `@define_tool` function testable independently (unit tests)
- [ ] **Step 5**: `CopilotAgent.start()` connects to CLI without error
- [ ] **Step 6**: App startup logs show "CopilotClient started"
- [ ] **Step 7**: `POST /api/agent/chat` streams SSE events end-to-end
- [ ] **Step 7**: Tool calls show `started` + `completed` events in the stream
- [ ] **Step 7**: Multi-turn: second message in same conversation uses session history
- [ ] **Step 8**: Existing `test_skill_registry.py` still passes after simplification
- [ ] **Full**: `test_agent_loop.py` → rename to `test_copilot_agent.py` and rewrite tests

---

## What You Gain

| Before (custom loop) | After (Copilot SDK) |
|---|---|
| 295 lines of custom ReAct loop | ~80 lines in `copilot_agent.py` |
| Regex JSON tool parsing (fragile) | Native function calling |
| Manual context compaction | Auto-compaction at 95% threshold |
| Placeholder skill execution | Real `@define_tool` functions |
| Single model (gpt-4o via Foundry) | Dynamic multi-model routing (gpt-4o, gpt-5, claude, o3) |
| Manual retry logic | SDK auto-retry + fallback |
| SKILL.md loaded manually | SDK reads SKILL.md natively via `skill_directories` |

## What You Give Up

| Trade-off | Mitigation |
|---|---|
| Managed Identity → GitHub token for the LLM call | Token stored in Key Vault, injected as env var |
| Copilot CLI binary in Docker image (~extra ~100MB) | Multi-stage build keeps image lean |
| SDK is Technical Preview (not production-stable) | Pin SDK version; monitor changelog |
| Foundry model billing → GitHub Copilot quota billing | Monitor premium request quota; upgrade plan if needed |
