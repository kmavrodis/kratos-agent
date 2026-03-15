"""Copilot SDK agent service.

Replaces agent_loop.py. Uses CopilotClient to manage sessions per conversation,
and translates SDK events to the existing SSE event schema.
Uses DefaultAzureCredential for keyless auth to Azure OpenAI.
"""

import asyncio
from importlib.metadata import version
import logging
import time
from typing import AsyncGenerator

from azure.identity.aio import ManagedIdentityCredential, get_bearer_token_provider
from copilot import CopilotClient, PermissionRequestResult

try:
    from azure.identity.aio import AzureCLICredential, ChainedTokenCredential

    _HAS_CLI_CREDENTIAL = True
except ImportError:
    _HAS_CLI_CREDENTIAL = False
from opentelemetry import trace

from app.config import Settings
from app.models import ContentEvent, ErrorEvent, ThoughtEvent, ToolCallEvent, UsageEvent
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

DEFAULT_SYSTEM_PROMPT = SYSTEM_PROMPT


class CopilotAgent:
    """Manages one CopilotClient shared across the app lifetime.

    Each conversation gets its own SDK session, preserving multi-turn history
    automatically without manually loading from Cosmos DB on every turn.
    Uses DefaultAzureCredential for keyless auth to Azure OpenAI.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: CopilotClient | None = None
        self._skill_registry: object | None = None
        self._sessions: dict[str, object] = {}
        self._system_prompt: str = DEFAULT_SYSTEM_PROMPT

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    @system_prompt.setter
    def system_prompt(self, value: str) -> None:
        self._system_prompt = value
        # Clear sessions so new chats pick up the updated prompt
        self._sessions.clear()
        logger.info("System prompt updated — all sessions reset")

    def set_skill_registry(self, registry: object) -> None:
        """Inject the skill registry for dynamic tool/skill resolution."""
        self._skill_registry = registry
        self._queues: dict[str, asyncio.Queue] = {}
        self._tool_counters: dict[str, int] = {}
        self._registered_handlers: set[str] = set()
        self._credential: ManagedIdentityCredential | None = None
        self._token_provider = None
        self._usage: dict[str, dict] = {}
        self._first_token_time: dict[str, float] = {}
        self._model_response_start: dict[str, float] = {}

    async def start(self) -> None:
        """Initialize the Copilot CLI client. Called once on app startup.

        Uses ManagedIdentityCredential (prod) with AzureCLICredential fallback (dev)
        instead of DefaultAzureCredential, which probes many credential sources
        sequentially and adds significant latency on each token acquisition.
        """
        if _HAS_CLI_CREDENTIAL:
            self._credential = ChainedTokenCredential(
                ManagedIdentityCredential(),
                AzureCLICredential(),
            )
        else:
            self._credential = ManagedIdentityCredential()
        scope = "https://cognitiveservices.azure.com/.default"
        self._token_provider = get_bearer_token_provider(self._credential, scope)

        # Pre-warm: acquire the first token now so user requests don't pay the cost
        try:
            t0 = time.monotonic()
            await self._credential.get_token(scope)
            logger.info("Token pre-warmed successfully in %.1fms", (time.monotonic() - t0) * 1000)
        except Exception:
            logger.warning("Token pre-warm failed — first request will be slower", exc_info=True)

        self._client = CopilotClient()
        await self._client.start()
        logger.info(
            "CopilotClient started (Managed Identity auth, sdk_version=%s)",
            version("github-copilot-sdk"),
        )

    async def stop(self) -> None:
        """Shutdown all sessions and the CLI client. Called on app shutdown."""
        for session in self._sessions.values():
            try:
                await session.destroy()
            except Exception:
                pass
        self._sessions.clear()
        self._registered_handlers.clear()
        self._queues.clear()
        self._tool_counters.clear()
        if self._client:
            await self._client.stop()
        if self._credential:
            await self._credential.close()
        logger.info("CopilotClient stopped")

    async def update_config(
        self,
        ai_services_endpoint: str,
        ai_services_model_deployment: str,
    ) -> None:
        """Update config and drop all sessions so they recreate with new settings."""
        if ai_services_endpoint:
            self.settings.ai_services_endpoint = ai_services_endpoint
        if ai_services_model_deployment:
            self.settings.ai_services_model_deployment = ai_services_model_deployment
            self.settings.ai_services_model_deployment = ai_services_model_deployment

        # Drop all existing sessions so they get recreated with the new config
        for session in self._sessions.values():
            try:
                await session.destroy()
            except Exception:
                pass
        self._sessions.clear()
        self._registered_handlers.clear()
        self._queues.clear()
        self._tool_counters.clear()
        logger.info("Config updated — all sessions reset")

    async def _get_or_create_session(self, conversation_id: str) -> object:
        """Return an existing session or create a new one for this conversation."""
        if conversation_id in self._sessions:
            logger.info("Reusing SDK session for conversation=%s", conversation_id)
            return self._sessions[conversation_id]

        # Resolve enabled tools and skill directories from the registry
        enabled_tools = ALL_TOOLS
        skill_dirs = [
            "./skills/web-search",
            "./skills/rag-search",
            "./skills/code-interpreter",
            "./skills/foundry-agent",
        ]
        if self._skill_registry is not None:
            enabled_names = self._skill_registry.get_enabled_tool_names()
            enabled_tools = [t for t in ALL_TOOLS if t.name in enabled_names]
            skill_dirs = self._skill_registry.get_skill_directories()

        t0 = time.monotonic()
        session = await self._client.create_session({
            "model": self.settings.ai_services_model_deployment,
            "streaming": True,
            "tools": enabled_tools,
            "skill_directories": skill_dirs,
            "system_message": {
                "mode": "replace",
                "content": self._system_prompt,
            },
            "provider": {
                "type": "azure",
                "base_url": f"{self.settings.ai_services_endpoint.rstrip('/')}/openai/deployments/{self.settings.ai_services_model_deployment}",
                "token_provider": self._token_provider,
                "wire_api": "completions",
                "azure": {
                    "api_version": "2024-10-21",
                },
            },
            "on_permission_request": lambda req, ctx: PermissionRequestResult(kind="approved"),
        })

        elapsed_ms = (time.monotonic() - t0) * 1000
        self._sessions[conversation_id] = session
        logger.info(
            "Created SDK session for conversation=%s model=%s custom_tools=%s elapsed=%.0fms",
            conversation_id,
            self.settings.ai_services_model_deployment,
            ",".join(tool.name for tool in enabled_tools),
            elapsed_ms,
        )
        return session

    async def run(
        self,
        message: str,
        conversation_id: str,
    ) -> AsyncGenerator[ThoughtEvent | ToolCallEvent | ContentEvent | ErrorEvent, None]:
        """Send a message and stream SDK events as typed SSE events."""

        with tracer.start_as_current_span("copilot_agent.run", attributes={"conversation_id": conversation_id}):
            queue: asyncio.Queue = asyncio.Queue()
            self._queues[conversation_id] = queue
            self._tool_counters[conversation_id] = 0
            self._usage[conversation_id] = {"prompt": 0, "completion": 0, "total": 0}
            self._first_token_time.pop(conversation_id, None)
            self._model_response_start.pop(conversation_id, None)

            try:
                session = await self._get_or_create_session(conversation_id)
                logger.info("Sending prompt for conversation=%s message=%r", conversation_id, message)
                self._send_time = time.monotonic()

                # Register the event handler ONCE per session, not per run() call.
                # The handler routes events to whatever queue is active for that conversation.
                if conversation_id not in self._registered_handlers:
                    cid = conversation_id  # capture for closure

                    _pending_tools: list[str] = []  # track started tools in order for matching

                    def on_event(event) -> None:
                        """Translate SDK events into our SSE event types."""
                        q = self._queues.get(cid)
                        if q is None:
                            return  # no active run for this conversation
                        try:
                            etype = event.type.value if hasattr(event.type, "value") else str(event.type)

                            # Log time-to-first-event from send
                            if hasattr(self, "_send_time"):
                                ttfe = (time.monotonic() - self._send_time) * 1000
                                logger.info("Event received type=%s ttfe=%.0fms conversation=%s", etype, ttfe, cid)

                            if etype == "assistant.message_delta":
                                # Track time-to-first-token
                                if cid not in self._first_token_time and hasattr(self, "_send_time"):
                                    self._first_token_time[cid] = (time.monotonic() - self._send_time) * 1000
                                q.put_nowait(ContentEvent(content=event.data.delta_content or ""))

                            elif etype == "assistant.turn_start":
                                # Model started processing — mark for latency calc
                                self._model_response_start[cid] = time.monotonic()

                            elif etype in ("assistant.usage", "session.usage_info"):
                                # Capture token usage from the model
                                data = event.data
                                prompt_t = int(getattr(data, "prompt_tokens", 0) or getattr(data, "input_tokens", 0) or 0)
                                completion_t = int(getattr(data, "completion_tokens", 0) or getattr(data, "output_tokens", 0) or 0)
                                total_t = int(getattr(data, "total_tokens", 0) or 0) or (prompt_t + completion_t)
                                usage = self._usage.get(cid, {"prompt": 0, "completion": 0, "total": 0})
                                usage["prompt"] += prompt_t
                                usage["completion"] += completion_t
                                usage["total"] += total_t
                                self._usage[cid] = usage
                                logger.info(
                                    "Usage conversation=%s prompt_tokens=%d completion_tokens=%d total=%d",
                                    cid, prompt_t, completion_t, total_t,
                                )
                                if total_t > 0:
                                    q.put_nowait(UsageEvent(
                                        promptTokens=usage["prompt"],
                                        completionTokens=usage["completion"],
                                        totalTokens=usage["total"],
                                    ))

                            elif etype == "tool.execution_start":
                                tool_name = getattr(event.data, "tool_name", None) or getattr(event.data, "name", None) or "unknown"
                                self._tool_counters[cid] = self._tool_counters.get(cid, 0) + 1
                                _pending_tools.append(tool_name)
                                logger.info("Tool start conversation=%s tool=%s pending=%s", cid, tool_name, _pending_tools)
                                q.put_nowait(ThoughtEvent(
                                    content=f"Calling tool: {tool_name}",
                                    iteration=0,
                                ))
                                q.put_nowait(ToolCallEvent(
                                    skillName=tool_name,
                                    status="started",
                                    input=str(getattr(event.data, "input", "")),
                                ))

                            elif etype == "tool.execution_complete":
                                # SDK often doesn't include tool_name on complete events,
                                # so match back to the oldest pending started tool.
                                raw_name = getattr(event.data, "tool_name", None) or getattr(event.data, "name", None)
                                if raw_name:
                                    tool_name = raw_name
                                    # Remove from pending if present
                                    if tool_name in _pending_tools:
                                        _pending_tools.remove(tool_name)
                                elif _pending_tools:
                                    tool_name = _pending_tools.pop(0)
                                else:
                                    tool_name = "unknown"
                                duration_ms = int(getattr(event.data, "duration_ms", 0) or getattr(event.data, "duration", 0) or 0)
                                success = getattr(event.data, "success", None)
                                error = getattr(event.data, "error", None)
                                logger.info(
                                    "Tool complete conversation=%s tool=%s success=%r duration_ms=%s error=%r",
                                    cid, tool_name, success, duration_ms, error,
                                )
                                q.put_nowait(ToolCallEvent(
                                    skillName=tool_name,
                                    status="completed" if success is not False else "failed",
                                    output=str(getattr(event.data, "output", "") or getattr(event.data, "result", ""))[:500],
                                    durationMs=duration_ms,
                                ))

                            elif etype == "session.idle":
                                tc = self._tool_counters.get(cid, 0)
                                usage = self._usage.get(cid, {"prompt": 0, "completion": 0, "total": 0})
                                ttft = int(self._first_token_time.get(cid, 0))
                                model_start = self._model_response_start.get(cid)
                                model_latency = int((time.monotonic() - model_start) * 1000) if model_start else 0
                                logger.info(
                                    "Session idle conversation=%s tool_events=%s tokens=%s ttft=%dms model_latency=%dms",
                                    cid, tc, usage, ttft, model_latency,
                                )
                                q.put_nowait(None)  # sentinel — stream is done

                            elif etype == "session.error":
                                logger.error(
                                    "Session error conversation=%s message=%s",
                                    cid,
                                    str(getattr(event.data, "message", "Unknown error")),
                                )
                                q.put_nowait(ErrorEvent(
                                    message=str(getattr(event.data, "message", "Unknown error")),
                                    code="SDK_ERROR",
                                ))
                                q.put_nowait(None)
                        except Exception:
                            logger.exception("Error in session event handler conversation=%s", cid)

                    session.on(on_event)
                    self._registered_handlers.add(conversation_id)

                await session.send({"prompt": message})

                # Drain the queue until sentinel
                while True:
                    item = await asyncio.wait_for(queue.get(), timeout=120.0)
                    if item is None:
                        break
                    yield item

                tool_events = self._tool_counters.get(conversation_id, 0)
                if tool_events == 0:
                    logger.warning(
                        "No tool events observed for conversation=%s prompt=%r",
                        conversation_id,
                        message,
                    )

            except asyncio.TimeoutError:
                logger.warning("Agent timed out for conversation=%s", conversation_id)
                yield ErrorEvent(message="Agent timed out waiting for response", code="TIMEOUT")
            except Exception as e:
                logger.exception("CopilotAgent failed for conversation=%s", conversation_id)
                yield ErrorEvent(message=str(e), code="AGENT_ERROR")
                # Drop the broken session so next turn gets a fresh one
                self._sessions.pop(conversation_id, None)
                self._registered_handlers.discard(conversation_id)
            finally:
                self._queues.pop(conversation_id, None)

    def get_run_stats(self, conversation_id: str) -> dict:
        """Return accumulated stats for the last run of a conversation."""
        usage = self._usage.get(conversation_id, {"prompt": 0, "completion": 0, "total": 0})
        ttft = int(self._first_token_time.get(conversation_id, 0))
        model_start = self._model_response_start.get(conversation_id)
        model_latency = int((time.monotonic() - model_start) * 1000) if model_start else 0
        return {
            "prompt_tokens": usage["prompt"],
            "completion_tokens": usage["completion"],
            "total_tokens": usage["total"],
            "time_to_first_token_ms": ttft,
            "model_latency_ms": model_latency,
        }
