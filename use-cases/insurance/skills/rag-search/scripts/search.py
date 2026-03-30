"""RAG Search MCP Skill — Azure AI Search knowledge base retrieval."""

import json
import os

from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient


async def search(query: str, top: int = 5) -> str:
    """Search the knowledge base using Azure AI Search.

    Args:
        query: The natural language search query.
        top: Number of results to return (default: 5).

    Returns:
        JSON string with search results.
    """
    endpoint = os.environ.get("AI_SEARCH_ENDPOINT", "")
    index_name = os.environ.get("AI_SEARCH_INDEX", "ins-knowledge-base")

    if not endpoint:
        return json.dumps({
            "status": "error",
            "message": "AI Search endpoint not configured. Set AI_SEARCH_ENDPOINT.",
        })

    credential = DefaultAzureCredential()
    client = SearchClient(
        endpoint=endpoint,
        index_name=index_name,
        credential=credential,
    )

    results_list = []
    results = client.search(
        search_text=query,
        top=top,
        query_type="semantic",
        semantic_configuration_name="default",
    )

    for result in results:
        results_list.append({
            "title": result.get("title", "Untitled"),
            "score": result.get("@search.score", 0),
            "content": str(result.get("content", ""))[:500],
            "source": result.get("source", ""),
            "page": result.get("page_number", ""),
        })

    return json.dumps({"status": "success", "query": query, "results": results_list})


if __name__ == "__main__":
    import asyncio
    import sys

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "company policies"
    result = asyncio.run(search(query))
    print(result)
