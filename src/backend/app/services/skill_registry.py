"""Skill registry — loads and manages skills from Cosmos DB.

Skills are stored in Cosmos DB so they can be managed via an admin panel.
On first startup (empty Cosmos), seeds from the local skills.yaml + SKILL.md files.
The SDK reads SKILL.md content from the instructions field stored in Cosmos.
"""

import logging
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

# File path for YAML seed data
_DEFAULT_SKILLS_YAML = "skills.yaml"

# Regex matching YAML frontmatter block: ---\n...\n---
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from SKILL.md content.

    Returns (frontmatter_dict, body_without_frontmatter).
    If no frontmatter is found, returns ({}, original_text).
    """
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    try:
        fm = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return {}, text
    body = text[match.end():]
    return fm, body


def _update_frontmatter(text: str, name: str, description: str) -> str:
    """Update or insert YAML frontmatter with the given name and description.

    Preserves the body content and any extra frontmatter fields.
    """
    fm, body = _parse_frontmatter(text)
    fm["name"] = name
    fm["description"] = description
    # Dump frontmatter in a stable key order
    fm_str = yaml.dump(fm, default_flow_style=False, sort_keys=False).strip()
    return f"---\n{fm_str}\n---\n\n{body.lstrip()}"


@dataclass
class SkillMetadata:
    """Metadata for a registered skill."""

    name: str
    description: str
    enabled: bool = True
    instructions: str = ""
    tool_name: str = ""  # maps to the @define_tool function name

    def to_cosmos_doc(self) -> dict:
        return {
            "id": self.name,
            "name": self.name,
            "description": self.description,
            "enabled": self.enabled,
            "instructions": self.instructions,
            "toolName": self.tool_name or self.name.replace("-", "_"),
        }

    @staticmethod
    def from_cosmos_doc(doc: dict) -> "SkillMetadata":
        return SkillMetadata(
            name=doc["name"],
            description=doc.get("description", ""),
            enabled=doc.get("enabled", True),
            instructions=doc.get("instructions", ""),
            tool_name=doc.get("toolName", ""),
        )


@dataclass
class SkillRegistry:
    """Registry of available skills backed by Cosmos DB.

    On load(), reads skills from Cosmos. If empty, seeds from local
    skills.yaml + SKILL.md files (first-run migration).
    """

    config_path: str = _DEFAULT_SKILLS_YAML
    skills: dict[str, SkillMetadata] = field(default_factory=dict)
    _cosmos_service: object | None = field(default=None, repr=False)

    async def load(self, cosmos_service: object | None = None) -> None:
        """Load skills from Cosmos DB, seeding from YAML on first run."""
        self._cosmos_service = cosmos_service

        # Try loading from Cosmos first
        if cosmos_service is not None:
            docs = await cosmos_service.list_skills()
            if docs:
                for doc in docs:
                    skill = SkillMetadata.from_cosmos_doc(doc)
                    self.skills[skill.name] = skill
                logger.info("Loaded %d skills from Cosmos DB", len(self.skills))
                return

            # Cosmos is empty — seed from local YAML + SKILL.md files
            logger.info("No skills in Cosmos — seeding from %s", self.config_path)
            await self._seed_from_yaml(cosmos_service)
            return

        # No Cosmos available — fall back to YAML-only loading (local dev)
        await self._load_from_yaml()

    async def _seed_from_yaml(self, cosmos_service: object) -> None:
        """Read skills.yaml + SKILL.md files, write them to Cosmos, and populate registry."""
        await self._load_from_yaml()
        for skill in self.skills.values():
            await cosmos_service.upsert_skill(skill.to_cosmos_doc())
        logger.info("Seeded %d skills into Cosmos DB", len(self.skills))

    async def _load_from_yaml(self) -> None:
        """Load skills from the local YAML config file (fallback / seed source)."""
        config_file = Path(self.config_path)
        if not config_file.exists():
            logger.warning("Skills config not found at %s", self.config_path)
            return

        with open(config_file) as f:
            config = yaml.safe_load(f)

        for skill_cfg in config.get("skills", []):
            name = skill_cfg["name"]
            skill_path = skill_cfg.get("path", "")

            # Read SKILL.md instructions if the file exists
            instructions = ""
            if skill_path:
                skill_md = Path(skill_path) / "SKILL.md"
                if skill_md.exists():
                    instructions = skill_md.read_text()

            # Use description from skills.yaml; ensure frontmatter stays in sync
            description = skill_cfg.get("description", "")
            if instructions:
                fm, _ = _parse_frontmatter(instructions)
                # If SKILL.md frontmatter has a richer description, prefer it
                if fm.get("description"):
                    description = fm["description"]
                # Re-write frontmatter so it matches the canonical description
                instructions = _update_frontmatter(instructions, name, description)

            skill = SkillMetadata(
                name=name,
                description=description,
                enabled=skill_cfg.get("enabled", True),
                instructions=instructions,
                tool_name=name.replace("-", "_"),
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
        """Write enabled skill instructions to temp files and return paths.

        The SDK expects file paths for skill_directories, so we materialize
        the Cosmos-stored instructions to a temp directory.
        """
        dirs: list[str] = []
        for skill in self.get_enabled_skills():
            if not skill.instructions:
                continue
            # Write to a temp file the SDK can read
            tmp_dir = Path(tempfile.gettempdir()) / "kratos-skills" / skill.name
            tmp_dir.mkdir(parents=True, exist_ok=True)
            skill_md_path = tmp_dir / "SKILL.md"
            skill_md_path.write_text(skill.instructions)
            dirs.append(str(skill_md_path))
        return dirs

    def get_enabled_tool_names(self) -> set[str]:
        """Return tool function names for enabled skills."""
        return {s.tool_name or s.name.replace("-", "_") for s in self.get_enabled_skills()}

    # ─── Admin operations ─────────────────────────────────────────────────

    async def update_skill(self, name: str, updates: dict) -> SkillMetadata | None:
        """Update a skill in the registry and Cosmos DB.

        Keeps SKILL.md frontmatter and Cosmos fields in sync:
        - If description changes, update frontmatter inside instructions.
        - If instructions change, extract name/description from frontmatter.
        """
        skill = self.skills.get(name)
        if not skill:
            return None

        if "enabled" in updates:
            skill.enabled = updates["enabled"]

        # If instructions changed, extract frontmatter into Cosmos fields
        if "instructions" in updates:
            skill.instructions = updates["instructions"]
            fm, _ = _parse_frontmatter(skill.instructions)
            if fm.get("description"):
                skill.description = fm["description"]

        # If description changed explicitly, update both field and frontmatter
        if "description" in updates:
            skill.description = updates["description"]
            if skill.instructions:
                skill.instructions = _update_frontmatter(
                    skill.instructions, skill.name, skill.description
                )

        self.skills[name] = skill

        if self._cosmos_service:
            await self._cosmos_service.upsert_skill(skill.to_cosmos_doc())

        return skill

    async def add_skill(self, skill: SkillMetadata) -> SkillMetadata:
        """Add a new skill to the registry and Cosmos DB.

        If instructions contain frontmatter, extract description from it.
        If instructions lack frontmatter, inject it from the Cosmos fields.
        """
        if skill.instructions:
            fm, _ = _parse_frontmatter(skill.instructions)
            if fm.get("description"):
                # Frontmatter has description — use it as the canonical value
                skill.description = fm["description"]
            # Ensure frontmatter is present and in sync
            skill.instructions = _update_frontmatter(
                skill.instructions, skill.name, skill.description
            )

        self.skills[skill.name] = skill

        if self._cosmos_service:
            await self._cosmos_service.upsert_skill(skill.to_cosmos_doc())

        logger.info("Added skill: %s", skill.name)
        return skill

    async def remove_skill(self, name: str) -> bool:
        """Remove a skill from the registry and Cosmos DB."""
        if name not in self.skills:
            return False

        del self.skills[name]

        if self._cosmos_service:
            await self._cosmos_service.delete_skill(name)

        logger.info("Removed skill: %s", name)
        return True
