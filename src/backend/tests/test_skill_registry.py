"""Tests for the skill registry."""

from pathlib import Path

import pytest

from app.services.skill_registry import SkillRegistry


@pytest.fixture
def use_case_dir(tmp_path: Path) -> Path:
    """Create a local use-cases directory with sample skills."""
    uc = tmp_path / "use-cases" / "generic"

    # System prompt
    uc.mkdir(parents=True)
    (uc / "SYSTEM_PROMPT.md").write_text(
        "---\ndisplayName: Generic Assistant\ndescription: A helpful AI assistant\n---\n\nYou are a helpful assistant."
    )

    # web-search skill
    ws = uc / "skills" / "web-search"
    ws.mkdir(parents=True)
    (ws / "SKILL.md").write_text(
        "---\nname: web-search\ndescription: Real-time internet search\nenabled: true\n---\n\n# Web Search"
    )

    # rag-search skill
    rs = uc / "skills" / "rag-search"
    rs.mkdir(parents=True)
    (rs / "SKILL.md").write_text(
        "---\nname: rag-search\ndescription: Azure AI Search knowledge base\nenabled: true\n---\n\n# RAG Search"
    )

    # disabled skill — enabled: false in frontmatter
    ds = uc / "skills" / "disabled-skill"
    ds.mkdir(parents=True)
    (ds / "SKILL.md").write_text(
        "---\nname: disabled-skill\ndescription: A disabled skill\nenabled: false\n---\n\n# Disabled Skill"
    )

    return tmp_path


@pytest.mark.asyncio
async def test_load_skills(use_case_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(use_case_dir)
    registry = SkillRegistry()
    await registry.load("generic")

    assert len(registry.skills) == 3
    assert "web-search" in registry.skills
    assert "rag-search" in registry.skills
    assert "disabled-skill" in registry.skills


@pytest.mark.asyncio
async def test_get_enabled_skills(use_case_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(use_case_dir)
    registry = SkillRegistry()
    await registry.load("generic")

    enabled = registry.get_enabled_skills()
    assert len(enabled) == 2
    names = [s.name for s in enabled]
    assert "web-search" in names
    assert "rag-search" in names
    assert "disabled-skill" not in names


@pytest.mark.asyncio
async def test_get_skill_directories(use_case_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(use_case_dir)
    registry = SkillRegistry()
    await registry.load("generic")

    dirs = registry.get_skill_directories()
    assert len(dirs) == 2
    assert any("web-search" in d for d in dirs)
    assert any("rag-search" in d for d in dirs)


@pytest.mark.asyncio
async def test_no_use_case_directory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    registry = SkillRegistry()
    await registry.load("nonexistent")
    assert len(registry.skills) == 0


@pytest.mark.asyncio
async def test_get_enabled_tool_names(use_case_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(use_case_dir)
    registry = SkillRegistry()
    await registry.load("generic")

    tool_names = registry.get_enabled_tool_names()
    assert "web_search" in tool_names
    assert "rag_search" in tool_names
    assert "disabled_skill" not in tool_names


@pytest.mark.asyncio
async def test_system_prompt_loaded(use_case_dir: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(use_case_dir)
    registry = SkillRegistry()
    await registry.load("generic")

    assert "You are a helpful assistant" in registry.system_prompt
    assert registry.use_case == "generic"
