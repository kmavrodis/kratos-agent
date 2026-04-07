"""Copilot Studio bridge — synchronous endpoints for Teams / M365 integration.

These endpoints are independent of the streaming /api/agent/* routes used by
the web frontend.  They accept a plain message, run the agent to completion,
and return the full reply as a single JSON response — which is what the
Copilot Studio REST API plugin model requires.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.models import (
    ContentEvent,
    CopilotStudioRequest,
    CopilotStudioResponse,
    Conversation,
    ConversationStatus,
    ErrorEvent,
    Message,
    MessageRole,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=CopilotStudioResponse)
async def copilot_studio_chat(
    body: CopilotStudioRequest,
    request: Request,
) -> CopilotStudioResponse:
    """Receive a message from Copilot Studio and return the agent's answer.

    If ``conversationId`` is omitted a new conversation is created automatically.
    """
    cosmos = request.app.state.cosmos_service
    copilot_agent = request.app.state.copilot_agent

    # Resolve or create conversation
    conversation_id = body.conversationId
    if not conversation_id:
        now = datetime.now(timezone.utc)
        conversation = Conversation(
            id=str(uuid.uuid4()),
            userId="copilot-studio",
            title=body.message[:80],
            useCase=body.useCase,
            status=ConversationStatus.ACTIVE,
            createdAt=now,
            updatedAt=now,
        )
        await cosmos.upsert_conversation(conversation)
        conversation_id = conversation.id

    copilot_agent.set_conversation_use_case(conversation_id, body.useCase)

    # Persist the incoming user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversationId=conversation_id,
        role=MessageRole.USER,
        content=body.message,
        createdAt=datetime.now(timezone.utc),
    )
    await cosmos.upsert_message(user_msg)

    # Run agent and collect the full reply
    parts: list[str] = []
    async for event in copilot_agent.run(
        message=body.message,
        conversation_id=conversation_id,
        attachments=None,
    ):
        if isinstance(event, ContentEvent):
            parts.append(event.content)
        elif isinstance(event, ErrorEvent):
            logger.error("Agent error (copilot-studio): %s", event.message)

    full_reply = "".join(parts)

    # Persist assistant response
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversationId=conversation_id,
        role=MessageRole.ASSISTANT,
        content=full_reply,
        createdAt=datetime.now(timezone.utc),
    )
    await cosmos.upsert_message(assistant_msg)

    return CopilotStudioResponse(
        conversationId=conversation_id,
        reply=full_reply,
    )
