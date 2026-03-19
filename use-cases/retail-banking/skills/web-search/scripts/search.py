"""Web Search Skill — Real-time internet search via Foundry Responses API.

Uses the web_search_preview tool through the Microsoft Foundry Responses API,
powered by Bing Grounding. Returns search results with URL citations.

Note: This script is a standalone reference implementation. The actual runtime
tool is defined in src/backend/app/services/skill_tools.py.
"""

import json
import os

import httpx
from azure.identity import DefaultAzureCredential


async def search(query: str) -> str:
    """Search the web using the Foundry Responses API with web_search_preview.

    Args:
        query: The search query string.

    Returns:
        JSON string with search text and URL citations.
    """
    foundry_endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")
    model_deployment = os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", "")

    if not foundry_endpoint or not model_deployment:
        return json.dumps({
            "status": "error",
            "message": "FOUNDRY_ENDPOINT or FOUNDRY_MODEL_DEPLOYMENT not configured.",
        })

    # Build the Responses API URL
    account_name = foundry_endpoint.rstrip("/").split("//")[1].split(".")[0]
    responses_url = (
        f"https://{account_name}.services.ai.azure.com/openai/responses"
        f"?api-version=2025-03-01-preview"
    )

    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            responses_url,
            headers={
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            },
            json={
                "model": model_deployment,
                "input": f"Search the web for: {query}. Return only factual search results with sources.",
                "tools": [{"type": "web_search_preview"}],
                "tool_choice": {"type": "web_search_preview"},
            },
        )
        response.raise_for_status()
        data = response.json()

    text = ""
    citations = []
    for item in data.get("output", []):
        if item.get("type") == "message":
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    text = content.get("text", "")
                    for ann in content.get("annotations", []):
                        if ann.get("type") == "url_citation":
                            citations.append({
                                "title": ann.get("title", ""),
                                "url": ann.get("url", ""),
                            })

    return json.dumps({"status": "success", "query": query, "text": text, "citations": citations})


if __name__ == "__main__":
    import asyncio
    import sys

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "current bank interest rates"
    result = asyncio.run(search(query))
    print(result)
