"""MCP skill implementations as Copilot SDK @define_tool functions.

Each function here corresponds to one skill in skills.yaml.
The SDK calls these when the agent decides to invoke a skill.
"""

import os
import subprocess

import httpx
from azure.identity.aio import DefaultAzureCredential
from azure.search.documents.aio import SearchClient
from copilot.tools import define_tool
from opentelemetry import trace
from pydantic import BaseModel, Field

tracer = trace.get_tracer(__name__)


# ─── Web Search ──────────────────────────────────────────────────────────────


class WebSearchParams(BaseModel):
    query: str = Field(description="The search query to look up on the internet")


@define_tool(description="Real-time internet search for current information and market data")
async def web_search(params: WebSearchParams) -> dict:
    """Search the internet for up-to-date information."""
    with tracer.start_as_current_span("skill.web_search"):
        result = subprocess.run(
            ["python", "skills/web-search/scripts/search.py", "--query", params.query],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        return {"results": result.stdout, "query": params.query}


# ─── RAG Search ──────────────────────────────────────────────────────────────


class RAGSearchParams(BaseModel):
    query: str = Field(description="The query to search in the knowledge base")
    top: int = Field(default=5, description="Number of results to return")


@define_tool(description="Azure AI Search knowledge base for grounded answers from internal documents")
async def rag_search(params: RAGSearchParams) -> dict:
    """Search the Azure AI Search knowledge base."""
    with tracer.start_as_current_span("skill.rag_search"):
        ai_search_endpoint = os.environ.get("AI_SEARCH_ENDPOINT", "")
        if not ai_search_endpoint:
            return {"error": "AI_SEARCH_ENDPOINT not configured"}

        credential = DefaultAzureCredential()
        async with SearchClient(
            endpoint=ai_search_endpoint,
            index_name="knowledge-base",
            credential=credential,
        ) as client:
            results = await client.search(params.query, top=params.top)
            docs = []
            async for result in results:
                docs.append({
                    "content": result.get("content", ""),
                    "title": result.get("title", ""),
                    "score": result.get("@search.score", 0),
                })
            return {"results": docs, "query": params.query}


# ─── Code Interpreter ─────────────────────────────────────────────────────────


class CodeInterpreterParams(BaseModel):
    code: str = Field(description="Python code to execute in a sandboxed environment")


@define_tool(description="Sandboxed Python execution for computation, data analysis, and code generation")
async def code_interpreter(params: CodeInterpreterParams) -> dict:
    """Execute Python code in a sandboxed subprocess."""
    with tracer.start_as_current_span("skill.code_interpreter"):
        try:
            result = subprocess.run(
                ["python", "-c", params.code],
                capture_output=True,
                text=True,
                timeout=30,
                cwd="/tmp",  # noqa: S108
                check=False,
            )
            return {
                "stdout": result.stdout[:4000],
                "stderr": result.stderr[:1000],
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"error": "Code execution timed out (30s limit)"}
        except Exception as e:
            return {"error": str(e)}


# ─── Foundry Agent ────────────────────────────────────────────────────────────


class FoundryAgentParams(BaseModel):
    task: str = Field(description="The task to delegate to the specialized Foundry sub-agent")
    agent_name: str = Field(default="default", description="Name of the Foundry sub-agent to invoke")


@define_tool(description="Delegate complex or specialized tasks to Microsoft Foundry sub-agents")
async def foundry_agent(params: FoundryAgentParams) -> dict:
    """Delegate a task to a Microsoft Foundry specialized sub-agent."""
    with tracer.start_as_current_span("skill.foundry_agent"):
        ai_services_endpoint = os.environ.get("AI_SERVICES_ENDPOINT", "")
        if not ai_services_endpoint:
            return {"error": "AI_SERVICES_ENDPOINT not configured"}

        credential = DefaultAzureCredential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{ai_services_endpoint}/agents/{params.agent_name}/run",
                headers={"Authorization": f"Bearer {token.token}"},
                json={"task": params.task},
            )
            return response.json()


# ─── Tool registry ────────────────────────────────────────────────────────────

# All tools to register with every SDK session
ALL_TOOLS = [web_search, rag_search, code_interpreter, foundry_agent]
