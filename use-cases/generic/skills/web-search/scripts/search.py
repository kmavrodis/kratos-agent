"""Web Search MCP Skill — Real-time internet search via Bing Search API."""

import json
import os

import httpx
from azure.identity import DefaultAzureCredential


async def search(query: str, count: int = 5) -> str:
    """Search the web using Bing Search API.

    Args:
        query: The search query string.
        count: Number of results to return (default: 5).

    Returns:
        JSON string with search results.
    """
    endpoint = os.environ.get("BING_SEARCH_ENDPOINT", "https://api.bing.microsoft.com/v7.0/search")
    api_key = os.environ.get("BING_SEARCH_API_KEY", "")

    if not api_key:
        # Try Managed Identity via Key Vault in production
        return json.dumps({
            "status": "error",
            "message": "Bing Search API key not configured. Set BING_SEARCH_API_KEY.",
        })

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            endpoint,
            params={"q": query, "count": count, "mkt": "en-US"},
            headers={"Ocp-Apim-Subscription-Key": api_key},
        )
        response.raise_for_status()
        data = response.json()

    results = []
    for page in data.get("webPages", {}).get("value", [])[:count]:
        results.append({
            "title": page.get("name", ""),
            "url": page.get("url", ""),
            "snippet": page.get("snippet", ""),
            "datePublished": page.get("dateLastCrawled", ""),
        })

    return json.dumps({"status": "success", "query": query, "results": results})


if __name__ == "__main__":
    import asyncio
    import sys

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Azure AI latest news"
    result = asyncio.run(search(query))
    print(result)
