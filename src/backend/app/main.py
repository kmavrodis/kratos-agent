"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.observability import setup_telemetry
from app.routers import agent, conversations, health, settings
from app.services.copilot_agent import CopilotAgent
from app.services.cosmos_service import CosmosService
from app.services.skill_registry import SkillRegistry

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)
# Silence chatty Azure SDK HTTP loggers — they log full request/response headers at INFO
logging.getLogger("azure.cosmos").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)

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

    # Initialize Copilot SDK agent (uses DefaultAzureCredential for Azure OpenAI)
    copilot_agent = CopilotAgent(settings)
    await copilot_agent.start()
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
