"""Skill registry — loads and manages MCP skills from skills.yaml."""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


@dataclass
class SkillMetadata:
    """Metadata for a registered MCP skill (Stage 1 — DISCOVER)."""

    name: str
    description: str
    enabled: bool = True
    path: str = ""
    instructions: str = ""  # Loaded on demand (Stage 2 — LOAD)


@dataclass
class SkillRegistry:
    """Registry of available MCP skills.

    Implements the progressive disclosure model:
    - Stage 1 (DISCOVER): name + description (~50 tokens per skill)
    - Stage 2 (LOAD): Full instructions loaded on demand
    - Stage 3 (EXECUTE): Scripts run at runtime
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

            # Try to load SKILL.md for instructions
            skill_md_path = Path(skill.path) / "SKILL.md"
            if skill_md_path.exists():
                skill.instructions = skill_md_path.read_text()

            self.skills[name] = skill
            logger.info("Registered skill: %s (enabled=%s)", name, skill.enabled)

        logger.info("Loaded %d skills from %s", len(self.skills), self.config_path)

    def get_enabled_skills(self) -> list[SkillMetadata]:
        """Return all enabled skills."""
        return [s for s in self.skills.values() if s.enabled]

    def get_skill(self, name: str) -> SkillMetadata | None:
        """Get a specific skill by name."""
        return self.skills.get(name)

    def get_discovery_context(self) -> str:
        """Build the discovery context string (~50 tokens per skill).

        This is Stage 1 — passed to the model so it knows what skills are available.
        """
        lines = ["Available skills:"]
        for skill in self.get_enabled_skills():
            lines.append(f"- {skill.name}: {skill.description}")
        return "\n".join(lines)
