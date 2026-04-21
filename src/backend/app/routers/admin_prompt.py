"""Admin API for managing the system prompt — stored in Cosmos DB settings container."""

import logging

from fastapi import APIRouter, Depends, Request

from app.auth import require_authenticated_user
from app.models import SystemPromptResponse, SystemPromptUpdate
from app.services.copilot_agent import DEFAULT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_authenticated_user)])

SETTING_ID = "system-prompt"


@router.get("", response_model=SystemPromptResponse)
async def get_system_prompt(request: Request) -> SystemPromptResponse:
    """Return the current system prompt."""
    cosmos = request.app.state.cosmos_service
    doc = await cosmos.get_setting(SETTING_ID)
    if doc:
        return SystemPromptResponse(content=doc["content"], isDefault=False)
    return SystemPromptResponse(content=DEFAULT_SYSTEM_PROMPT, isDefault=True)


@router.put("", response_model=SystemPromptResponse)
async def update_system_prompt(body: SystemPromptUpdate, request: Request) -> SystemPromptResponse:
    """Update the system prompt. Clears all active sessions so new chats use it."""
    cosmos = request.app.state.cosmos_service
    copilot_agent = request.app.state.copilot_agent

    await cosmos.upsert_setting({
        "id": SETTING_ID,
        "category": "system",
        "content": body.content,
    })

    await copilot_agent.update_system_prompt(body.content)
    logger.info("System prompt updated via admin API (%d chars)", len(body.content))
    return SystemPromptResponse(content=body.content, isDefault=False)


@router.delete("", status_code=204)
async def reset_system_prompt(request: Request) -> None:
    """Reset to the default system prompt by deleting the custom one from Cosmos."""
    cosmos = request.app.state.cosmos_service
    copilot_agent = request.app.state.copilot_agent

    await cosmos.delete_setting(SETTING_ID)

    await copilot_agent.update_system_prompt(DEFAULT_SYSTEM_PROMPT)
    logger.info("System prompt reset to default")
