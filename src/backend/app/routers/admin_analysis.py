"""Admin API for analyzing use-case consistency — detects contradictions, overlaps, and gaps."""

import json
import logging
import os
import time

import httpx
from azure.identity.aio import DefaultAzureCredential
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.services.skill_registry import SkillRegistry

logger = logging.getLogger(__name__)

router = APIRouter()

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
        _http_client = httpx.AsyncClient(timeout=120.0)
    return _http_client


def _get_registry(request: Request, use_case: str) -> SkillRegistry:
    """Resolve the SkillRegistry for the given use-case."""
    registries = getattr(request.app.state, "registries", {})
    registry = registries.get(use_case)
    if registry is None:
        registry = getattr(request.app.state, "skill_registry", None)
    if registry is None:
        raise HTTPException(status_code=404, detail=f"Use-case '{use_case}' not found")
    return registry


ANALYSIS_SYSTEM_PROMPT = """You are an expert AI configuration auditor. Your job is to analyze an AI agent's system prompt and skill definitions for inconsistencies, contradictions, overlaps, and gaps that could confuse the LLM during runtime.

You will receive:
1. The SYSTEM PROMPT that the agent uses
2. A list of all SKILL DEFINITIONS (each with name, description, enabled status, and full instructions)

Perform a thorough analysis and return a JSON object with the following structure:

{
  "summary": "A 2-3 sentence overall assessment",
  "overallScore": <number 0-100>,
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "contradiction" | "overlap" | "gap" | "terminology" | "tone" | "ambiguity" | "unused",
      "title": "Short title of the issue",
      "description": "Detailed explanation of the issue",
      "affectedSkills": ["skill-name-1", "skill-name-2"],
      "recommendation": "How to fix this"
    }
  ],
  "strengths": [
    "A positive aspect of the current configuration"
  ]
}

Categories explained:
- **contradiction**: The system prompt says one thing but a skill says the opposite (e.g. "never share PII" vs a skill that exposes PII)
- **overlap**: Two or more skills claim to handle the same domain/scenario, causing the LLM to pick inconsistently
- **gap**: The system prompt promises a capability that no skill implements, or a skill exists but is never referenced in routing logic
- **terminology**: Inconsistent naming — the system prompt calls something by one name, skills call it differently
- **tone**: Persona/style conflicts between the system prompt's expected tone and how skill instructions are written
- **ambiguity**: Instructions that are vague or could be interpreted multiple ways by the LLM
- **unused**: Skills that are enabled but seem disconnected from the system prompt's workflow

Rules:
- Be specific — cite exact phrases from the system prompt or skills when pointing out issues
- Rate severity accurately: critical = will definitely confuse the LLM, warning = may cause issues, info = minor style improvement
- The overallScore should reflect: 90+ = excellent, 70-89 = good with some issues, 50-69 = needs attention, <50 = significant problems
- Always find at least a few strengths to highlight
- Return ONLY the JSON object, no markdown wrapping, no code fences"""


class AnalysisRequest(BaseModel):
    """Optional overrides for the analysis."""
    includeDisabled: bool = Field(default=True, description="Include disabled skills in the analysis")


class AnalysisIssue(BaseModel):
    severity: str
    category: str
    title: str
    description: str
    affectedSkills: list[str] = Field(default_factory=list)
    recommendation: str = ""


class AnalysisResponse(BaseModel):
    summary: str
    overallScore: int
    issues: list[AnalysisIssue]
    strengths: list[str] = Field(default_factory=list)
    durationMs: int = 0


def _build_analysis_content(registry: SkillRegistry, include_disabled: bool) -> str:
    """Build the user-message content with the system prompt and all skills."""
    import re

    parts: list[str] = []

    # System prompt
    prompt = registry.system_prompt or "(No system prompt configured)"
    # Strip YAML frontmatter for analysis
    m = re.match(r"^---\s*\n.*?\n---\s*\n?", prompt, re.DOTALL)
    if m:
        prompt = prompt[m.end():].strip()
    parts.append("=== SYSTEM PROMPT ===\n")
    parts.append(prompt)
    parts.append("\n\n")

    # Skills
    skills = list(registry.skills.values())
    if not include_disabled:
        skills = [s for s in skills if s.enabled]

    parts.append(f"=== SKILL DEFINITIONS ({len(skills)} skills) ===\n\n")
    for skill in sorted(skills, key=lambda s: s.name):
        parts.append(f"--- Skill: {skill.name} ---")
        parts.append(f"Description: {skill.description}")
        parts.append(f"Enabled: {skill.enabled}")
        parts.append(f"Tool Name: {skill.tool_name}")
        if skill.instructions:
            # Strip frontmatter from skill instructions too
            instr = skill.instructions
            m = re.match(r"^---\s*\n.*?\n---\s*\n?", instr, re.DOTALL)
            if m:
                instr = instr[m.end():].strip()
            parts.append(f"Instructions:\n{instr}")
        else:
            parts.append("Instructions: (none)")
        parts.append("")

    return "\n".join(parts)


@router.post("/consistency", response_model=AnalysisResponse)
async def analyze_consistency(
    request: Request,
    body: AnalysisRequest | None = None,
    use_case: str = Query("generic"),
) -> AnalysisResponse:
    """Analyze a use-case's system prompt and skills for inconsistencies."""
    t0 = time.monotonic()
    registry = _get_registry(request, use_case)
    include_disabled = body.includeDisabled if body else True

    content = _build_analysis_content(registry, include_disabled)
    logger.info("Consistency analysis for '%s': %d chars", use_case, len(content))

    # Call Foundry model
    foundry_endpoint = os.environ.get("FOUNDRY_ENDPOINT", "")
    model_deployment = os.environ.get("FOUNDRY_MODEL_DEPLOYMENT", "")
    if not foundry_endpoint or not model_deployment:
        raise HTTPException(status_code=503, detail="FOUNDRY_ENDPOINT or FOUNDRY_MODEL_DEPLOYMENT not configured")

    account_name = foundry_endpoint.rstrip("/").split("//")[1].split(".")[0]
    chat_url = (
        f"https://{account_name}.services.ai.azure.com/openai/deployments/"
        f"{model_deployment}/chat/completions?api-version=2024-12-01-preview"
    )

    try:
        credential = _get_credential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")
    except Exception as e:
        logger.error("Auth failed for consistency analysis: %s", e)
        raise HTTPException(status_code=503, detail=f"Authentication failed: {e}") from e

    payload = {
        "messages": [
            {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        "temperature": 0.3,
        "max_completion_tokens": 4096,
        "response_format": {"type": "json_object"},
    }

    try:
        client = _get_http_client()
        resp = await client.post(
            chat_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("Foundry API error: %s %s", e.response.status_code, e.response.text[:500])
        raise HTTPException(status_code=502, detail=f"LLM API error: {e.response.status_code}") from e
    except Exception as e:
        logger.error("Failed to call Foundry for analysis: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    try:
        data = resp.json()
        raw_content = data["choices"][0]["message"]["content"]
        result = json.loads(raw_content)
    except (KeyError, json.JSONDecodeError, IndexError) as e:
        logger.error("Failed to parse analysis response: %s", e)
        raise HTTPException(status_code=502, detail="Failed to parse LLM response") from e

    duration_ms = int((time.monotonic() - t0) * 1000)

    return AnalysisResponse(
        summary=result.get("summary", ""),
        overallScore=result.get("overallScore", 0),
        issues=[AnalysisIssue(**issue) for issue in result.get("issues", [])],
        strengths=result.get("strengths", []),
        durationMs=duration_ms,
    )
