"""Generate context-aware follow-up questions after each agent response.

Uses a lightweight direct LLM call (not the full Copilot SDK agent loop)
to suggest sophisticated follow-ups that showcase Kratos's skill set.
"""

import json
import logging
import os

import httpx
from azure.identity.aio import DefaultAzureCredential

logger = logging.getLogger(__name__)

_credential: DefaultAzureCredential | None = None
_http_client: httpx.AsyncClient | None = None


def _get_credential() -> DefaultAzureCredential:
    global _credential
    if _credential is None:
        _credential = DefaultAzureCredential()
    return _credential


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


FOLLOW_UP_SYSTEM_PROMPT = """\
You generate follow-up questions for an enterprise AI assistant called Kratos.

Rules:
- Produce exactly 3 follow-up questions as a JSON array of strings.
- Each question should be a SPECIFIC, actionable request (not vague or generic).
- Questions should showcase capabilities: data analysis, code generation, web search, document drafting, file creation, cross-referencing multiple tools.
- Questions should logically continue or deepen the conversation — not repeat what was already answered.
- Keep each question under 120 characters.
- Do NOT include numbering, bullets, or prefixes — just the question text.
- Return ONLY the JSON array, no other text.

Example output:
["Create a comparison chart of the top 3 options and export it as a PDF", "Run a Monte Carlo simulation on those projections using Python", "Search for the latest regulatory changes that could impact this analysis"]
"""


async def generate_follow_ups(
    user_message: str,
    assistant_response: str,
    skill_names: list[str] | None = None,
) -> list[str]:
    """Return up to 3 follow-up question suggestions based on the conversation turn.

    Returns an empty list on any failure (non-blocking, best-effort).
    """
    foundry_endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")
    model_deployment = os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", "")
    if not foundry_endpoint or not model_deployment:
        return []

    account_name = foundry_endpoint.rstrip("/").split("//")[1].split(".")[0]
    chat_url = (
        f"https://{account_name}.services.ai.azure.com/openai/deployments/"
        f"{model_deployment}/chat/completions?api-version=2024-12-01-preview"
    )

    # Build a concise user prompt
    skills_hint = ""
    if skill_names:
        skills_hint = f"\nAvailable skills: {', '.join(skill_names)}"

    # Truncate to keep the request small
    user_excerpt = user_message[:500]
    assistant_excerpt = assistant_response[:1500]

    user_content = (
        f"User asked: {user_excerpt}\n\n"
        f"Assistant answered: {assistant_excerpt}"
        f"{skills_hint}\n\n"
        "Generate 3 follow-up questions."
    )

    try:
        credential = _get_credential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")

        client = _get_http_client()
        resp = await client.post(
            chat_url,
            json={
                "messages": [
                    {"role": "system", "content": FOLLOW_UP_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "temperature": 0.7,
                "max_completion_tokens": 256,
            },
            headers={
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()

        raw = resp.json()["choices"][0]["message"]["content"].strip()
        questions = json.loads(raw)
        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str)][:3]
    except Exception:
        logger.warning("Follow-up generation failed — skipping", exc_info=True)

    return []
