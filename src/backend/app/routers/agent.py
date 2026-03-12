"""Agent endpoint — accepts user prompts and streams agentic loop responses via SSE."""

import json
import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.models import (
    AgentRequest,
    ContentEvent,
    DoneEvent,
    ErrorEvent,
    Message,
    MessageRole,
    ThoughtEvent,
    ToolCallEvent,
)
from app.services.agent_loop import AgentLoop

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat")
async def chat(body: AgentRequest, request: Request) -> EventSourceResponse:
    """Run the agentic loop and stream results as Server-Sent Events.

    The response is a stream of JSON events:
    - thought: Agent reasoning / plan
    - tool_call: MCP skill invocation (started/completed/failed)
    - content: Response text chunks
    - done: Completion signal with metrics
    - error: Error details
    """
    cosmos = request.app.state.cosmos_service
    skill_registry = request.app.state.skill_registry

    async def event_generator():  # noqa: ANN202
        start_time = time.monotonic()
        total_tool_calls = 0

        try:
            # Persist user message
            user_message = Message(
                id=str(uuid.uuid4()),
                conversationId=body.conversationId,
                role=MessageRole.USER,
                content=body.message,
                createdAt=datetime.now(timezone.utc),
            )
            await cosmos.upsert_message(user_message)

            # Load conversation history
            history = await cosmos.list_messages(body.conversationId)

            # Run the agentic loop
            agent_loop = AgentLoop(skill_registry=skill_registry, settings=request.app.state.cosmos_service.settings)

            assistant_content_parts: list[str] = []

            async for event in agent_loop.run(
                message=body.message,
                history=history,
                conversation_id=body.conversationId,
            ):
                if isinstance(event, ThoughtEvent):
                    yield {"event": "thought", "data": json.dumps(event.model_dump())}
                elif isinstance(event, ToolCallEvent):
                    if event.status == "completed":
                        total_tool_calls += 1
                    yield {"event": "tool_call", "data": json.dumps(event.model_dump())}
                elif isinstance(event, ContentEvent):
                    assistant_content_parts.append(event.content)
                    yield {"event": "content", "data": json.dumps(event.model_dump())}
                elif isinstance(event, ErrorEvent):
                    yield {"event": "error", "data": json.dumps(event.model_dump())}

            # Persist assistant response
            assistant_message = Message(
                id=str(uuid.uuid4()),
                conversationId=body.conversationId,
                role=MessageRole.ASSISTANT,
                content="".join(assistant_content_parts),
                metadata={"tool_calls": total_tool_calls},
                createdAt=datetime.now(timezone.utc),
            )
            await cosmos.upsert_message(assistant_message)

            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            done = DoneEvent(
                conversationId=body.conversationId,
                totalDurationMs=elapsed_ms,
                totalToolCalls=total_tool_calls,
            )
            yield {"event": "done", "data": json.dumps(done.model_dump())}

        except Exception:
            logger.exception("Agent loop failed for conversation=%s", body.conversationId)
            error = ErrorEvent(message="An internal error occurred", code="AGENT_LOOP_ERROR")
            yield {"event": "error", "data": json.dumps(error.model_dump())}

    return EventSourceResponse(event_generator())
