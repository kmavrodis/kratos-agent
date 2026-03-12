"""Foundry Agent MCP Skill — Delegate tasks to Microsoft Foundry sub-agents."""

import json
import os

import httpx
from azure.identity import DefaultAzureCredential


async def evaluate(prompt: str, response: str) -> str:
    """Evaluate an agent response using Foundry evaluation pipeline.

    Args:
        prompt: The original user prompt.
        response: The agent's response to evaluate.

    Returns:
        JSON string with evaluation scores.
    """
    endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")

    if not endpoint:
        return json.dumps({
            "status": "error",
            "message": "Foundry endpoint not configured.",
        })

    credential = DefaultAzureCredential()
    token = await credential.get_token("https://cognitiveservices.azure.com/.default")

    # Foundry evaluation endpoint
    eval_url = f"{endpoint.rstrip('/')}/evaluation/evaluate"

    async with httpx.AsyncClient(timeout=30.0) as client:
        result = await client.post(
            eval_url,
            headers={
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            },
            json={
                "prompt": prompt,
                "response": response,
                "evaluators": ["coherence", "relevance", "groundedness", "fluency"],
            },
        )
        result.raise_for_status()

    return json.dumps({"status": "success", "evaluation": result.json()})


async def check_safety(content: str) -> str:
    """Check content through Foundry safety guardrails.

    Args:
        content: The content to check for safety.

    Returns:
        JSON string with safety assessment.
    """
    endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")

    if not endpoint:
        return json.dumps({
            "status": "error",
            "message": "Foundry endpoint not configured.",
        })

    credential = DefaultAzureCredential()
    token = await credential.get_token("https://cognitiveservices.azure.com/.default")

    safety_url = f"{endpoint.rstrip('/')}/contentsafety/text:analyze"

    async with httpx.AsyncClient(timeout=15.0) as client:
        result = await client.post(
            safety_url,
            headers={
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            },
            json={
                "text": content,
                "categories": ["Hate", "SelfHarm", "Sexual", "Violence"],
                "outputType": "FourSeverityLevels",
            },
        )
        result.raise_for_status()

    return json.dumps({"status": "success", "safety": result.json()})


if __name__ == "__main__":
    import asyncio

    result = asyncio.run(check_safety("This is a test sentence for safety checking."))
    print(result)
