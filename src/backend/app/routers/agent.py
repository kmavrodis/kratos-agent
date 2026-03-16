"""Agent endpoint — accepts user prompts and streams Copilot SDK responses via SSE."""

import base64
import json
import logging
import os
import tempfile
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
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
    UsageEvent,
    UserInputRequestEvent,
    UserInputResponseRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat")
async def chat(body: AgentRequest, request: Request) -> EventSourceResponse:
    """Run the Copilot SDK agent and stream results as Server-Sent Events.

    The response is a stream of JSON events:
    - thought: Agent reasoning / plan
    - tool_call: MCP skill invocation (started/completed/failed)
    - content: Response text chunks
    - done: Completion signal with metrics
    - error: Error details
    """
    cosmos = request.app.state.cosmos_service
    copilot_agent = request.app.state.copilot_agent

    # Associate conversation with the requested use-case
    copilot_agent.set_conversation_use_case(body.conversationId, body.useCase)

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

            # Convert attachments to SDK format — write uploaded content to temp files
            sdk_attachments = None
            temp_files: list[str] = []
            if body.attachments:
                sdk_attachments = []
                for att in body.attachments:
                    dumped = att.model_dump()
                    if dumped.get("content") and dumped.get("type") == "file":
                        # Decode base64 content and write to a temp file
                        raw = base64.b64decode(dumped["content"])
                        suffix = os.path.splitext(dumped.get("path", ""))[1] or ""
                        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="kratos-")
                        os.write(fd, raw)
                        os.close(fd)
                        temp_files.append(tmp_path)
                        sdk_attachments.append({
                            "type": "file",
                            "path": tmp_path,
                            "displayName": dumped.get("displayName", ""),
                        })
                    else:
                        # Strip content field for non-upload attachments
                        dumped.pop("content", None)
                        sdk_attachments.append(dumped)

            # Run the Copilot SDK agent
            assistant_content_parts: list[str] = []

            async for event in copilot_agent.run(
                message=body.message,
                conversation_id=body.conversationId,
                attachments=sdk_attachments,
            ):
                if isinstance(event, ThoughtEvent):
                    yield {"event": "thought", "data": json.dumps(event.model_dump())}
                elif isinstance(event, ToolCallEvent):
                    if event.status == "completed":
                        total_tool_calls += 1
                    yield {"event": "tool_call", "data": json.dumps(event.model_dump())}
                elif isinstance(event, UsageEvent):
                    yield {"event": "usage", "data": json.dumps(event.model_dump())}
                elif isinstance(event, ContentEvent):
                    assistant_content_parts.append(event.content)
                    yield {"event": "content", "data": json.dumps(event.model_dump())}
                elif isinstance(event, UserInputRequestEvent):
                    yield {"event": "user_input_request", "data": json.dumps(event.model_dump())}
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
            stats = copilot_agent.get_run_stats(body.conversationId)
            done = DoneEvent(
                conversationId=body.conversationId,
                totalDurationMs=elapsed_ms,
                totalToolCalls=total_tool_calls,
                promptTokens=stats["prompt_tokens"],
                completionTokens=stats["completion_tokens"],
                reasoningTokens=stats.get("reasoning_tokens", 0),
                totalTokens=stats["total_tokens"],
                timeToFirstTokenMs=stats["time_to_first_token_ms"],
                modelLatencyMs=stats["model_latency_ms"],
            )
            yield {"event": "done", "data": json.dumps(done.model_dump())}

        except Exception:
            logger.exception("Copilot agent failed for conversation=%s", body.conversationId)
            error = ErrorEvent(message="An internal error occurred", code="AGENT_ERROR")
            yield {"event": "error", "data": json.dumps(error.model_dump())}
        finally:
            # Clean up temp files created for uploaded attachments
            for tmp in temp_files:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass

    return EventSourceResponse(event_generator())


@router.post("/user-input")
async def user_input_response(body: UserInputResponseRequest, request: Request) -> JSONResponse:
    """Respond to a user input request from the agent (ask_user tool)."""
    copilot_agent = request.app.state.copilot_agent
    resolved = copilot_agent.resolve_user_input(body.requestId, body.answer)
    if not resolved:
        return JSONResponse(
            status_code=404,
            content={"error": "User input request not found or already resolved"},
        )
    return JSONResponse(content={"status": "ok"})
