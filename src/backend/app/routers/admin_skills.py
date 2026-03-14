"""Admin API for managing skills — CRUD operations backed by Cosmos DB."""

import logging

from fastapi import APIRouter, HTTPException, Request

from app.models import SkillCreate, SkillList, SkillResponse, SkillUpdate
from app.services.skill_registry import SkillMetadata, SkillRegistry

logger = logging.getLogger(__name__)

router = APIRouter()


def _reset_sessions(request: Request) -> None:
    """Clear all SDK sessions so new conversations pick up skill changes."""
    copilot_agent = getattr(request.app.state, "copilot_agent", None)
    if copilot_agent is not None:
        copilot_agent._sessions.clear()
        logger.info("Cleared SDK sessions after skill change")


def _to_response(skill: SkillMetadata) -> SkillResponse:
    return SkillResponse(
        name=skill.name,
        description=skill.description,
        enabled=skill.enabled,
        instructions=skill.instructions,
        toolName=skill.tool_name or skill.name.replace("-", "_"),
    )


@router.get("", response_model=SkillList)
async def list_skills(request: Request) -> SkillList:
    """List all registered skills."""
    registry: SkillRegistry = request.app.state.skill_registry
    skills = sorted(registry.skills.values(), key=lambda s: s.name)
    return SkillList(skills=[_to_response(s) for s in skills])


@router.get("/{skill_name}", response_model=SkillResponse)
async def get_skill(skill_name: str, request: Request) -> SkillResponse:
    """Get a single skill by name."""
    registry: SkillRegistry = request.app.state.skill_registry
    skill = registry.get_skill(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found")
    return _to_response(skill)


@router.post("", response_model=SkillResponse, status_code=201)
async def create_skill(body: SkillCreate, request: Request) -> SkillResponse:
    """Create a new skill definition."""
    registry: SkillRegistry = request.app.state.skill_registry

    if registry.get_skill(body.name):
        raise HTTPException(status_code=409, detail=f"Skill '{body.name}' already exists")

    skill = SkillMetadata(
        name=body.name,
        description=body.description,
        enabled=body.enabled,
        instructions=body.instructions,
        tool_name=body.name.replace("-", "_"),
    )
    await registry.add_skill(skill)
    _reset_sessions(request)
    logger.info("Admin created skill: %s", body.name)
    return _to_response(skill)


@router.patch("/{skill_name}", response_model=SkillResponse)
async def update_skill(skill_name: str, body: SkillUpdate, request: Request) -> SkillResponse:
    """Update an existing skill (partial update)."""
    registry: SkillRegistry = request.app.state.skill_registry

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    skill = await registry.update_skill(skill_name, updates)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found")

    _reset_sessions(request)
    logger.info("Admin updated skill: %s fields=%s", skill_name, list(updates.keys()))
    return _to_response(skill)


@router.delete("/{skill_name}", status_code=204)
async def delete_skill(skill_name: str, request: Request) -> None:
    """Delete a skill definition."""
    registry: SkillRegistry = request.app.state.skill_registry

    removed = await registry.remove_skill(skill_name)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found")

    _reset_sessions(request)
    logger.info("Admin deleted skill: %s", skill_name)
