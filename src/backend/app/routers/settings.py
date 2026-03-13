"""Settings endpoint — lets users configure BYOK credentials at runtime."""

import logging

from fastapi import APIRouter, Request

from app.models import BYOKSettings, BYOKStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=BYOKStatus)
async def get_settings(request: Request) -> BYOKStatus:
    """Return current BYOK config status (never exposes the API key)."""
    agent = request.app.state.copilot_agent
    return BYOKStatus(
        configured=bool(agent._foundry_api_key),
        foundryEndpoint=agent.settings.foundry_endpoint,
        foundryModelDeployment=agent.settings.foundry_model_deployment,
    )


@router.post("", response_model=BYOKStatus)
async def update_settings(body: BYOKSettings, request: Request) -> BYOKStatus:
    """Update the BYOK configuration. Resets all active sessions."""
    agent = request.app.state.copilot_agent
    await agent.update_config(
        foundry_endpoint=body.foundryEndpoint,
        foundry_model_deployment=body.foundryModelDeployment,
        foundry_api_key=body.foundryApiKey,
    )
    logger.info("BYOK settings updated via API")
    return BYOKStatus(
        configured=bool(agent._foundry_api_key),
        foundryEndpoint=agent.settings.foundry_endpoint,
        foundryModelDeployment=agent.settings.foundry_model_deployment,
    )
