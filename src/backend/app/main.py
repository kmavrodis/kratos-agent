"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from azure.identity.aio import DefaultAzureCredential
from azure.keyvault.secrets.aio import SecretClient
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.observability import setup_telemetry
from app.routers import agent, conversations, health, settings
from app.services.copilot_agent import CopilotAgent
from app.services.cosmos_service import CosmosService
from app.services.skill_registry import SkillRegistry

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialize services on startup, cleanup on shutdown."""
    settings = get_settings()

    # Setup OpenTelemetry
    setup_telemetry(settings)

    # Initialize Cosmos DB service
    cosmos_service = CosmosService(settings)
    await cosmos_service.initialize()
    application.state.cosmos_service = cosmos_service

    # Load skill registry
    skill_registry = SkillRegistry(settings.skills_config_path)
    await skill_registry.load()
    application.state.skill_registry = skill_registry

    # Fetch Foundry API key from Key Vault via Managed Identity
    foundry_api_key = ""
    if settings.key_vault_uri:
        try:
            async with SecretClient(settings.key_vault_uri, DefaultAzureCredential()) as kv:
                secret = await kv.get_secret("foundry-api-key")
                foundry_api_key = secret.value
        except Exception as exc:
            logger.warning("Could not fetch foundry-api-key from Key Vault: %s. BYOK can be configured via the settings API.", exc)
    else:
        # Local dev fallback — read from env (never in production)
        foundry_api_key = settings.foundry_api_key

    # Initialize Copilot SDK agent
    copilot_agent = CopilotAgent(settings)
    await copilot_agent.start(foundry_api_key)
    application.state.copilot_agent = copilot_agent

    logger.info("Kratos Agent Service started — environment=%s", settings.environment)
    yield

    # Cleanup
    await copilot_agent.stop()
    logger.info("Kratos Agent Service shutting down")


app = FastAPI(
    title="Kratos Agent Service",
    description="Agentic AI backend powered by GitHub Copilot SDK & Microsoft Foundry",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — configured for Static Web App frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Narrowed in production via environment config
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, tags=["health"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
