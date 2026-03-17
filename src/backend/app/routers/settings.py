"""Settings endpoint — lets users view and update AI service configuration at runtime."""

import logging

from fastapi import APIRouter, Request

from app.models import AIServiceSettings, AIServiceStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=AIServiceStatus)
async def get_settings(request: Request) -> AIServiceStatus:
    """Return current AI service config status."""
    agent = request.app.state.copilot_agent
    return AIServiceStatus(
        configured=bool(agent.settings.foundry_endpoint),
        foundryEndpoint=agent.settings.foundry_endpoint,
        foundryModelDeployment=agent.settings.foundry_model_deployment,
    )


@router.post("", response_model=AIServiceStatus)
async def update_settings(body: AIServiceSettings, request: Request) -> AIServiceStatus:
    """Update the AI service configuration. Resets all active sessions."""
    agent = request.app.state.copilot_agent
    await agent.update_config(
        foundry_endpoint=body.foundryEndpoint,
        foundry_model_deployment=body.foundryModelDeployment,
    )
    logger.info("AI service settings updated via API")
    return AIServiceStatus(
        configured=bool(agent.settings.foundry_endpoint),
        foundryEndpoint=agent.settings.foundry_endpoint,
        foundryModelDeployment=agent.settings.foundry_model_deployment,
    )
