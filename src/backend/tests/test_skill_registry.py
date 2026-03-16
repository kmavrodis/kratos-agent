"""Tests for the skill registry."""

from pathlib import Path

import pytest

from app.services.skill_registry import SkillRegistry


@pytest.fixture
def skills_dir(tmp_path: Path) -> Path:
    """Create a local skills directory with sample skills."""
    # web-search skill
    ws = tmp_path / "skills" / "web-search"
    ws.mkdir(parents=True)
    (ws / "SKILL.md").write_text(
        "---\nname: web-search\ndescription: Real-time internet search\nenabled: true\n---\n\n# Web Search"
    )

    # rag-search skill
    rs = tmp_path / "skills" / "rag-search"
    rs.mkdir(parents=True)
    (rs / "SKILL.md").write_text(
        "---\nname: rag-search\ndescription: Azure AI Search knowledge base\nenabled: true\n---\n\n# RAG Search"
    )

    # disabled skill — enabled: false in frontmatter
    ds = tmp_path / "skills" / "disabled-skill"
    ds.mkdir(parents=True)
    (ds / "SKILL.md").write_text(
        "---\nname: disabled-skill\ndescription: A disabled skill\nenabled: false\n---\n\n# Disabled Skill"
    )

    return tmp_path / "skills"


@pytest.mark.asyncio
async def test_load_skills(skills_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(skills_dir.parent)
    registry = SkillRegistry()
    await registry.load()

    assert len(registry.skills) == 3
    assert "web-search" in registry.skills
    assert "rag-search" in registry.skills
    assert "disabled-skill" in registry.skills


@pytest.mark.asyncio
async def test_get_enabled_skills(skills_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(skills_dir.parent)
    registry = SkillRegistry()
    await registry.load()

    enabled = registry.get_enabled_skills()
    assert len(enabled) == 2
    names = [s.name for s in enabled]
    assert "web-search" in names
    assert "rag-search" in names
    assert "disabled-skill" not in names


@pytest.mark.asyncio
async def test_get_skill_directories(skills_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(skills_dir.parent)
    registry = SkillRegistry()
    await registry.load()

    dirs = registry.get_skill_directories()
    assert len(dirs) == 2
    assert any("web-search" in d for d in dirs)
    assert any("rag-search" in d for d in dirs)


@pytest.mark.asyncio
async def test_no_skills_directory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    registry = SkillRegistry()
    await registry.load()
    assert len(registry.skills) == 0


@pytest.mark.asyncio
async def test_get_enabled_tool_names(skills_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(skills_dir.parent)
    registry = SkillRegistry()
    await registry.load()

    tool_names = registry.get_enabled_tool_names()
    assert "web_search" in tool_names
    assert "rag_search" in tool_names
    assert "disabled_skill" not in tool_names
