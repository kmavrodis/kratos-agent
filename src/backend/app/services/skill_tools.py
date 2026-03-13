"""MCP skill implementations as Copilot SDK @define_tool functions.

Each function here corresponds to one skill in skills.yaml.
The SDK calls these when the agent decides to invoke a skill.
"""

import json
import logging
import os
import subprocess
import time

import httpx

logger = logging.getLogger(__name__)
from azure.identity.aio import DefaultAzureCredential
from azure.search.documents.aio import SearchClient
from copilot.tools import define_tool
from copilot.types import ToolInvocation
from opentelemetry import trace
from pydantic import BaseModel, Field

tracer = trace.get_tracer(__name__)

# ─── Shared singletons — avoid recreating expensive objects on every tool call ─

_credential: DefaultAzureCredential | None = None
_http_client: httpx.AsyncClient | None = None
_bing_api_key: str | None = None  # cached after first Key Vault fetch


def _get_credential() -> DefaultAzureCredential:
    global _credential
    if _credential is None:
        _credential = DefaultAzureCredential()
    return _credential


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15.0)
    return _http_client


async def _get_bing_api_key() -> str:
    """Return the cached Bing API key, fetching from Key Vault on first call."""
    global _bing_api_key
    if _bing_api_key is not None:
        return _bing_api_key

    key_vault_uri = os.environ.get("KEY_VAULT_URI", "")
    if key_vault_uri:
        from azure.keyvault.secrets.aio import SecretClient as KVSecretClient

        credential = _get_credential()
        async with KVSecretClient(key_vault_uri, credential) as kv:
            secret = await kv.get_secret("bing-search-api-key")
            _bing_api_key = secret.value
            logger.info("Fetched Bing API key from Key Vault (cached for future calls)")
            return _bing_api_key

    # Fallback to env var
    _bing_api_key = os.environ.get("BING_SEARCH_API_KEY", "")
    return _bing_api_key


# ─── Web Search ──────────────────────────────────────────────────────────────


class WebSearchParams(BaseModel):
    query: str = Field(default="", description="The search query to look up on the internet")


def _extract_query_argument(raw_arguments: object, fallback: str = "") -> str:
    if isinstance(raw_arguments, dict):
        for key in ("query", "q", "input", "text"):
            value = raw_arguments.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return fallback.strip()

    if isinstance(raw_arguments, str):
        candidate = raw_arguments.strip()
        if not candidate or candidate.lower() == "none":
            return fallback.strip()

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            return candidate

        if isinstance(parsed, dict):
            return _extract_query_argument(parsed, fallback)
        if isinstance(parsed, str):
            return parsed.strip()

    return fallback.strip()


def _get_invocation_arguments(invocation: ToolInvocation | object) -> object:
    if isinstance(invocation, dict):
        return invocation.get("arguments")
    return getattr(invocation, "arguments", None)


@define_tool(description="Real-time internet search for current information and market data")
async def web_search(params: WebSearchParams, invocation: ToolInvocation) -> dict:
    """Search the internet for up-to-date information using Bing Search API."""
    with tracer.start_as_current_span("skill.web_search"):
        t0 = time.monotonic()
        raw_arguments = _get_invocation_arguments(invocation)
        query = _extract_query_argument(raw_arguments, params.query)
        endpoint = os.environ.get("BING_SEARCH_ENDPOINT", "https://api.bing.microsoft.com")
        search_url = endpoint.rstrip("/") + "/v7.0/search"
        logger.info("web_search called: resolved_query=%r search_url=%s", query, search_url)

        if not query:
            return {"error": "Missing required search query for web_search", "receivedArguments": raw_arguments}

        try:
            api_key = await _get_bing_api_key()
        except Exception as e:
            logger.error("Failed to fetch Bing API key: %s", e)
            return {"error": f"Failed to fetch Bing API key: {e}"}

        if not api_key:
            return {"error": "Bing Search API key not available"}

        t1 = time.monotonic()
        try:
            client = _get_http_client()
            response = await client.get(
                search_url,
                params={"q": query, "count": 5, "mkt": "en-US"},
                headers={"Ocp-Apim-Subscription-Key": api_key},
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error("Bing Search API call failed: %s", e)
            return {"error": f"Bing Search API call failed: {e}"}

        results = []
        for page in data.get("webPages", {}).get("value", [])[:5]:
            results.append({
                "title": page.get("name", ""),
                "url": page.get("url", ""),
                "snippet": page.get("snippet", ""),
            })
        logger.info(
            "web_search returned %d results for query=%s keyvault_ms=%.0f bing_ms=%.0f",
            len(results), query,
            (t1 - t0) * 1000, (time.monotonic() - t1) * 1000,
        )
        return {"results": results, "query": query}


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

        credential = _get_credential()
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

        credential = _get_credential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")

        client = _get_http_client()
        response = await client.post(
            f"{ai_services_endpoint}/agents/{params.agent_name}/run",
            headers={"Authorization": f"Bearer {token.token}"},
            json={"task": params.task},
        )
        return response.json()


# ─── Tool registry ────────────────────────────────────────────────────────────

# All tools to register with every SDK session
ALL_TOOLS = [web_search, rag_search, code_interpreter, foundry_agent]
