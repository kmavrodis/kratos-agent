"""Skill registry — loads and manages MCP skills from skills.yaml.

Simplified for Copilot SDK: the SDK reads SKILL.md files natively via
skill_directories, so we no longer need get_discovery_context() or
the instructions field.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


@dataclass
class SkillMetadata:
    """Metadata for a registered MCP skill."""

    name: str
    description: str
    enabled: bool = True
    path: str = ""


@dataclass
class SkillRegistry:
    """Registry of available MCP skills.

    Loads skills.yaml to know which skills are enabled/disabled.
    Provides skill paths to CopilotAgent for SDK session creation.
    The SDK reads SKILL.md files natively via skill_directories.
    """

    config_path: str = "skills.yaml"
    skills: dict[str, SkillMetadata] = field(default_factory=dict)

    async def load(self) -> None:
        """Load skill metadata from skills.yaml."""
        config_file = Path(self.config_path)
        if not config_file.exists():
            logger.warning("Skills config not found at %s", self.config_path)
            return

        with open(config_file) as f:
            config = yaml.safe_load(f)

        for skill_cfg in config.get("skills", []):
            name = skill_cfg["name"]
            skill = SkillMetadata(
                name=name,
                description=skill_cfg.get("description", ""),
                enabled=skill_cfg.get("enabled", True),
                path=skill_cfg.get("path", ""),
            )
            self.skills[name] = skill
            logger.info("Registered skill: %s (enabled=%s)", name, skill.enabled)

        logger.info("Loaded %d skills from %s", len(self.skills), self.config_path)

    def get_enabled_skills(self) -> list[SkillMetadata]:
        """Return all enabled skills."""
        return [s for s in self.skills.values() if s.enabled]

    def get_skill(self, name: str) -> SkillMetadata | None:
        """Get a specific skill by name."""
        return self.skills.get(name)

    def get_skill_directories(self) -> list[str]:
        """Return SKILL.md paths for all enabled skills (used by CopilotAgent)."""
        dirs = []
        for skill in self.get_enabled_skills():
            skill_md = Path(skill.path) / "SKILL.md"
            if skill_md.exists():
                dirs.append(str(skill_md))
        return dirs
