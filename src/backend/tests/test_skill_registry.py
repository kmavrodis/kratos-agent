"""Tests for the skill registry."""

import tempfile
from pathlib import Path

import pytest

from app.services.skill_registry import SkillRegistry


@pytest.fixture
def skills_yaml(tmp_path: Path) -> str:
    config = tmp_path / "skills.yaml"
    config.write_text("""
skills:
  - name: web-search
    description: Real-time internet search
    enabled: true
    path: ./skills/web-search

  - name: rag-search
    description: Azure AI Search knowledge base
    enabled: true
    path: ./skills/rag-search

  - name: disabled-skill
    description: A disabled skill
    enabled: false
    path: ./skills/disabled
""")
    return str(config)


@pytest.mark.asyncio
async def test_load_skills(skills_yaml: str):
    registry = SkillRegistry(config_path=skills_yaml)
    await registry.load()

    assert len(registry.skills) == 3
    assert "web-search" in registry.skills
    assert "rag-search" in registry.skills
    assert "disabled-skill" in registry.skills


@pytest.mark.asyncio
async def test_get_enabled_skills(skills_yaml: str):
    registry = SkillRegistry(config_path=skills_yaml)
    await registry.load()

    enabled = registry.get_enabled_skills()
    assert len(enabled) == 2
    names = [s.name for s in enabled]
    assert "web-search" in names
    assert "rag-search" in names
    assert "disabled-skill" not in names


@pytest.mark.asyncio
async def test_get_discovery_context(skills_yaml: str):
    registry = SkillRegistry(config_path=skills_yaml)
    await registry.load()

    context = registry.get_discovery_context()
    assert "web-search" in context
    assert "rag-search" in context
    assert "disabled-skill" not in context


@pytest.mark.asyncio
async def test_missing_config():
    registry = SkillRegistry(config_path="/nonexistent/skills.yaml")
    await registry.load()
    assert len(registry.skills) == 0
