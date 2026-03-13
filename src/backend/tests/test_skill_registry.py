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
async def test_get_skill_directories(skills_yaml: str, tmp_path: Path):
    """Test that get_skill_directories returns paths for enabled skills with SKILL.md."""
    # Create SKILL.md files for the enabled skills
    web_search_dir = tmp_path / "skills" / "web-search"
    web_search_dir.mkdir(parents=True)
    (web_search_dir / "SKILL.md").write_text("# Web Search Skill")

    rag_search_dir = tmp_path / "skills" / "rag-search"
    rag_search_dir.mkdir(parents=True)
    (rag_search_dir / "SKILL.md").write_text("# RAG Search Skill")

    # Update skills.yaml to point to tmp_path paths
    config = tmp_path / "skills_dirs.yaml"
    config.write_text(f"""
skills:
  - name: web-search
    description: Real-time internet search
    enabled: true
    path: {web_search_dir}

  - name: rag-search
    description: Azure AI Search knowledge base
    enabled: true
    path: {rag_search_dir}

  - name: disabled-skill
    description: A disabled skill
    enabled: false
    path: {tmp_path}/skills/disabled
""")
    registry = SkillRegistry(config_path=str(config))
    await registry.load()

    dirs = registry.get_skill_directories()
    assert len(dirs) == 2
    assert any("web-search" in d for d in dirs)
    assert any("rag-search" in d for d in dirs)


@pytest.mark.asyncio
async def test_missing_config():
    registry = SkillRegistry(config_path="/nonexistent/skills.yaml")
    await registry.load()
    assert len(registry.skills) == 0
