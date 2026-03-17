"""Foundry Agent Service — registers the Kratos agent in the Foundry portal.

On startup, creates/updates a PromptAgentDefinition so the agent appears in
the Foundry portal's Agents tab with its tools and system prompt.
"""

import logging
from typing import TYPE_CHECKING

from azure.identity.aio import ManagedIdentityCredential

try:
    from azure.identity.aio import AzureCLICredential, ChainedTokenCredential

    _HAS_CLI_CREDENTIAL = True
except ImportError:
    _HAS_CLI_CREDENTIAL = False

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)

AGENT_NAME = "kratos-agent"


async def register_foundry_agent(settings: "Settings", system_prompt: str, tool_names: list[str]) -> None:
    """Register or update the Kratos agent in Foundry Agent Service.

    This makes the agent visible in the Foundry portal Agents tab.
    """
    if not settings.foundry_endpoint or not settings.foundry_project_name:
        logger.warning("Foundry endpoint or project name not configured — skipping agent registration")
        return

    try:
        from azure.ai.projects.aio import AIProjectClient
        from azure.ai.projects.models import (
            FunctionTool,
            PromptAgentDefinition,
        )
    except ImportError:
        logger.warning("azure-ai-projects not installed — skipping Foundry agent registration")
        return

    # Build the project endpoint:  https://<account>.services.ai.azure.com/api/projects/<project>
    # The foundry_endpoint looks like https://<account>.cognitiveservices.azure.com/
    # We need the services.ai.azure.com variant
    account_name = settings.foundry_endpoint.rstrip("/").split("//")[1].split(".")[0]
    project_endpoint = (
        f"https://{account_name}.services.ai.azure.com/api/projects/{settings.foundry_project_name}"
    )

    if _HAS_CLI_CREDENTIAL:
        credential = ChainedTokenCredential(
            ManagedIdentityCredential(),
            AzureCLICredential(),
        )
    else:
        credential = ManagedIdentityCredential()

    try:
        project_client = AIProjectClient(
            endpoint=project_endpoint,
            credential=credential,
        )

        # Build tool definitions from our registered tool names
        tools = []
        for name in tool_names:
            tools.append(
                FunctionTool(
                    name=name,
                    description=f"Kratos {name.replace('_', ' ')} skill",
                    parameters={},
                )
            )

        definition = PromptAgentDefinition(
            model=settings.foundry_model_deployment,
            instructions=system_prompt[:4000],  # Foundry has limits on instruction length
            tools=tools,
        )

        await project_client.agents.create_version(
            agent_name=AGENT_NAME,
            definition=definition,
            description="Kratos Enterprise AI Agent — powered by Copilot SDK & Microsoft Foundry",
            metadata={
                "service": "kratos-agent-service",
                "framework": "copilot-sdk",
            },
        )
        logger.info("Foundry agent '%s' registered/updated in project '%s'", AGENT_NAME, settings.foundry_project_name)

        await project_client.close()
        await credential.close()

    except Exception:
        logger.warning("Failed to register agent in Foundry — agent tab may not show it", exc_info=True)
        try:
            await credential.close()
        except Exception:
            pass
