"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.observability import instrument_fastapi_app, setup_telemetry
from app.routers import admin_analysis, admin_mcp, admin_prompt, admin_skills, agent, conversations, copilot_studio, files, health, settings, use_cases
from app.services.blob_skill_service import BlobSkillService
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

    # Setup OpenTelemetry (traces, metrics, logs/events exporters)
    setup_telemetry(settings)

    # Initialize Cosmos DB service
    cosmos_service = CosmosService(settings)
    await cosmos_service.initialize()
    application.state.cosmos_service = cosmos_service

    # Initialize Blob Storage service for skills
    blob_skill_service = BlobSkillService(settings)
    await blob_skill_service.initialize()
    application.state.blob_skill_service = blob_skill_service

    # Load all use-case registries from blob storage
    registries: dict[str, SkillRegistry] = {}
    if not blob_skill_service.is_available:
        logger.error("Blob storage is not configured — no skills will be available")
    else:
        try:
            use_case_names = await blob_skill_service.list_use_cases()
            for uc_name in use_case_names:
                registry = SkillRegistry()
                await registry.load(uc_name, blob_skill_service)
                registries[uc_name] = registry
        except Exception:
            logger.exception("Failed to load use-cases from blob storage")

    application.state.registries = registries
    # Keep backward compat: skill_registry points to "generic"
    application.state.skill_registry = registries.get("generic", SkillRegistry())
    logger.info("Loaded %d use-cases: %s", len(registries), list(registries.keys()))

    # Initialize Copilot SDK agent (uses DefaultAzureCredential for Microsoft Foundry)
    copilot_agent = CopilotAgent(settings)
    copilot_agent.set_registries(registries)
    copilot_agent.set_cosmos_service(cosmos_service)

    # Load system prompt from Cosmos (falls back to default if not set)
    prompt_doc = await cosmos_service.get_setting("system-prompt")
    if prompt_doc:
        copilot_agent.system_prompt = prompt_doc["content"]
        logger.info("Loaded custom system prompt from Cosmos (%d chars)", len(prompt_doc["content"]))

    await copilot_agent.start()
    application.state.copilot_agent = copilot_agent

    logger.info("Kratos Agent Service started — environment=%s", settings.environment)
    yield

    # Cleanup
    await copilot_agent.stop()
    await blob_skill_service.close()
    logger.info("Kratos Agent Service shutting down")


app = FastAPI(
    title="Kratos Agent Service",
    description="Agentic AI backend powered by GitHub Copilot SDK & Microsoft Foundry",
    version="0.1.0",
    lifespan=lifespan,
)

# Instrument FastAPI BEFORE first request (middleware must be added before stack is built).
# Uses global ProxyTracerProvider; real provider is set by setup_telemetry() in the lifespan.
instrument_fastapi_app(app)

# CORS — configured for Static Web App frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Narrowed in production via environment config
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, tags=["health"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(admin_skills.router, prefix="/api/admin/skills", tags=["admin"])
app.include_router(admin_prompt.router, prefix="/api/admin/system-prompt", tags=["admin"])
app.include_router(admin_mcp.router, prefix="/api/admin/mcp-servers", tags=["admin"])
app.include_router(admin_analysis.router, prefix="/api/admin/analysis", tags=["admin"])
app.include_router(use_cases.router, prefix="/api/use-cases", tags=["use-cases"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(copilot_studio.router, prefix="/api/copilot-studio", tags=["copilot-studio"])
