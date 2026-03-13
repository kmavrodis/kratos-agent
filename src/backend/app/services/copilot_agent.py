"""Copilot SDK agent service.

Replaces agent_loop.py. Uses CopilotClient to manage sessions per conversation,
and translates SDK events to the existing SSE event schema.
Uses DefaultAzureCredential for keyless auth to Azure OpenAI.
"""

import asyncio
import logging
from typing import AsyncGenerator

from azure.identity.aio import DefaultAzureCredential, get_bearer_token_provider
from copilot import CopilotClient
from opentelemetry import trace

from app.config import Settings
from app.models import ContentEvent, ErrorEvent, ThoughtEvent, ToolCallEvent
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
    Uses DefaultAzureCredential for keyless auth to Azure OpenAI.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: CopilotClient | None = None
        self._sessions: dict[str, object] = {}
        self._credential: DefaultAzureCredential | None = None
        self._token_provider = None

    async def start(self) -> None:
        """Initialize the Copilot CLI client. Called once on app startup.

        Uses DefaultAzureCredential to get tokens for Azure OpenAI — no API keys needed.
        """
        self._credential = DefaultAzureCredential()
        self._token_provider = get_bearer_token_provider(
            self._credential, "https://cognitiveservices.azure.com/.default"
        )
        self._client = CopilotClient()
        await self._client.start()
        logger.info("CopilotClient started (Managed Identity auth)")

    async def stop(self) -> None:
        """Shutdown all sessions and the CLI client. Called on app shutdown."""
        for session in self._sessions.values():
            try:
                await session.destroy()
            except Exception:
                pass
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
        logger.info("Config updated — all sessions reset")

    async def _get_or_create_session(self, conversation_id: str) -> object:
        """Return an existing session or create a new one for this conversation."""
        if conversation_id in self._sessions:
            return self._sessions[conversation_id]

        skill_directories = [
            "./skills/web-search/SKILL.md",
            "./skills/rag-search/SKILL.md",
            "./skills/code-interpreter/SKILL.md",
            "./skills/foundry-agent/SKILL.md",
        ]

        session = await self._client.create_session({
            "model": self.settings.ai_services_model_deployment,
            "streaming": True,
            "tools": ALL_TOOLS,
            "skill_directories": skill_directories,
            "system_message": {
                "mode": "append",
                "content": SYSTEM_PROMPT,
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

            try:
                session = await self._get_or_create_session(conversation_id)

                def on_event(event) -> None:
                    """Translate SDK events into our SSE event types."""
                    etype = event.type.value if hasattr(event.type, "value") else str(event.type)

                    if etype == "assistant.message_delta":
                        queue.put_nowait(ContentEvent(content=event.data.delta_content or ""))

                    elif etype == "tool.execution_start":
                        queue.put_nowait(ThoughtEvent(
                            content=f"Calling tool: {event.data.tool_name}",
                            iteration=0,
                        ))
                        queue.put_nowait(ToolCallEvent(
                            skillName=event.data.tool_name,
                            status="started",
                            input=str(getattr(event.data, "input", "")),
                        ))

                    elif etype == "tool.execution_complete":
                        duration_ms = int(getattr(event.data, "duration_ms", 0))
                        queue.put_nowait(ToolCallEvent(
                            skillName=event.data.tool_name,
                            status="completed",
                            output=str(getattr(event.data, "output", ""))[:500],
                            durationMs=duration_ms,
                        ))

                    elif etype == "session.idle":
                        queue.put_nowait(None)  # sentinel — stream is done

                    elif etype == "session.error":
                        queue.put_nowait(ErrorEvent(
                            message=str(getattr(event.data, "message", "Unknown error")),
                            code="SDK_ERROR",
                        ))
                        queue.put_nowait(None)

                session.on(on_event)

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
