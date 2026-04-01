"""Skill registry — loads and manages skills from Azure Blob Storage.

Skills are organized into use-cases:
  use-cases/{use-case}/SYSTEM_PROMPT.md
  use-cases/{use-case}/skills/{name}/SKILL.md
  use-cases/{use-case}/skills/{name}/scripts/...

All metadata (name, description, enabled) lives in the SKILL.md YAML
frontmatter.  Each use-case has its own SkillRegistry instance and
system prompt.  On startup, the service loads all use-cases from blob
(or local fallback) into an in-memory dict of registries.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from app.services.blob_skill_service import BlobSkillService

logger = logging.getLogger(__name__)

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


def _update_frontmatter(text: str, **updates: object) -> str:
    """Update YAML frontmatter fields, preserving body and other fields."""
    fm, body = _parse_frontmatter(text)
    fm.update(updates)
    fm_str = yaml.dump(fm, default_flow_style=False, sort_keys=False).strip()
    return f"---\n{fm_str}\n---\n\n{body.lstrip()}"


def _skill_from_md(name: str, instructions: str, local_path: str = "") -> "SkillMetadata":
    """Build a SkillMetadata from a SKILL.md string, using frontmatter for all fields."""
    fm, _ = _parse_frontmatter(instructions)
    return SkillMetadata(
        name=fm.get("name", name),
        description=fm.get("description", ""),
        enabled=fm.get("enabled", True),
        instructions=instructions,
        tool_name=fm.get("name", name).replace("-", "_"),
        local_path=local_path,
    )


@dataclass
class SkillMetadata:
    """Metadata for a registered skill."""

    name: str
    description: str
    enabled: bool = True
    instructions: str = ""
    tool_name: str = ""  # maps to the @define_tool function name
    local_path: str = ""  # local filesystem path after sync


@dataclass
class SkillRegistry:
    """Registry of available skills for a single use-case.

    Each use-case gets its own SkillRegistry loaded from blob or local disk.
    """

    use_case: str = "generic"
    system_prompt: str = ""
    skills: dict[str, SkillMetadata] = field(default_factory=dict)
    mcp_servers: dict = field(default_factory=dict)
    _blob_service: BlobSkillService | None = field(default=None, repr=False)

    async def load(self, use_case: str, blob_service: BlobSkillService | None = None) -> None:
        """Load skills for a use-case from blob storage."""
        self.use_case = use_case
        self._blob_service = blob_service

        if blob_service is not None and blob_service.is_available:
            # Sync this use-case from blob → local filesystem
            await blob_service.sync_to_local(use_case)
            local_dir = blob_service.local_dir(use_case)

            # Read system prompt
            prompt_path = local_dir / "SYSTEM_PROMPT.md"
            if prompt_path.exists():
                self.system_prompt = prompt_path.read_text()

            # Load MCP servers config
            mcp_path = local_dir / ".mcp.json"
            if mcp_path.exists():
                try:
                    self.mcp_servers = json.loads(mcp_path.read_text())
                    logger.info("Loaded MCP servers (blob) for '%s': %s", use_case, list(self.mcp_servers.keys()))
                except json.JSONDecodeError:
                    logger.warning("Invalid .mcp.json for use-case '%s'", use_case)
            else:
                logger.info("No .mcp.json found at %s (blob path)", mcp_path)

            # Load skills
            for skill_name in await blob_service.list_skill_names(use_case):
                skill_md_path = local_dir / "skills" / skill_name / "SKILL.md"
                if not skill_md_path.exists():
                    continue
                instructions = skill_md_path.read_text()
                skill = _skill_from_md(skill_name, instructions, str(local_dir / "skills" / skill_name))
                self.skills[skill.name] = skill

            logger.info("Loaded use-case '%s': %d skills from blob", use_case, len(self.skills))
            return

        # No blob available — fall back to local use-cases/ directory
        await self._load_from_local(use_case)

    async def _load_from_local(self, use_case: str) -> None:
        """Load a use-case from the baked-in use-cases/ directory (local dev fallback)."""
        uc_dir = Path("use-cases") / use_case
        if not uc_dir.exists():
            logger.warning("No local use-case directory found: %s", uc_dir)
            return

        # Read system prompt
        prompt_path = uc_dir / "SYSTEM_PROMPT.md"
        if prompt_path.exists():
            self.system_prompt = prompt_path.read_text()

        # Load MCP servers config
        mcp_path = uc_dir / ".mcp.json"
        if mcp_path.exists():
            try:
                self.mcp_servers = json.loads(mcp_path.read_text())
                logger.info("Loaded MCP servers for '%s': %s", use_case, list(self.mcp_servers.keys()))
            except json.JSONDecodeError:
                logger.warning("Invalid .mcp.json for use-case '%s'", use_case)
        else:
            logger.info("No .mcp.json found at %s", mcp_path)

        # Load skills
        skills_dir = uc_dir / "skills"
        if not skills_dir.exists():
            logger.warning("No skills directory in use-case: %s", use_case)
            return

        for skill_dir in sorted(skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue

            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue

            instructions = skill_md.read_text()
            skill = _skill_from_md(skill_dir.name, instructions, str(skill_dir))
            self.skills[skill.name] = skill
            logger.info("Registered skill: %s/%s (enabled=%s)", use_case, skill.name, skill.enabled)

        logger.info("Loaded use-case '%s': %d skills from local", use_case, len(self.skills))

    def get_enabled_skills(self) -> list[SkillMetadata]:
        """Return all enabled skills."""
        return [s for s in self.skills.values() if s.enabled]

    def get_skill(self, name: str) -> SkillMetadata | None:
        """Get a specific skill by name."""
        return self.skills.get(name)

    def get_skill_directories(self) -> list[str]:
        """Return local directory paths for enabled skills with instructions.

        The SDK expects directory paths containing SKILL.md files.
        After blob sync, these are already on the local filesystem.
        """
        dirs: list[str] = []
        for skill in self.get_enabled_skills():
            if skill.local_path:
                skill_dir = Path(skill.local_path)
                # Ensure SKILL.md is written (may have been updated via admin)
                if skill.instructions:
                    skill_dir.mkdir(parents=True, exist_ok=True)
                    (skill_dir / "SKILL.md").write_text(skill.instructions)
                if skill_dir.exists():
                    dirs.append(str(skill_dir))
        return dirs

    def get_enabled_tool_names(self) -> set[str]:
        """Return tool function names for enabled skills."""
        return {s.tool_name or s.name.replace("-", "_") for s in self.get_enabled_skills()}

    def list_skill_files(self, name: str) -> list[dict[str, str]]:
        """List non-SKILL.md files in a skill's local directory."""
        skill = self.skills.get(name)
        if not skill or not skill.local_path:
            return []
        skill_dir = Path(skill.local_path)
        if not skill_dir.exists():
            return []
        files = []
        for f in sorted(skill_dir.rglob("*")):
            if f.is_file() and f.name != "SKILL.md":
                relative = str(f.relative_to(skill_dir))
                files.append({"path": relative, "name": f.name})
        return files

    async def upsert_skill_file(self, skill_name: str, file_path: str, content: bytes) -> None:
        """Upload or update a file in a skill folder (local + blob)."""
        skill = self.skills.get(skill_name)
        if not skill:
            return
        if skill.local_path:
            local_file = Path(skill.local_path) / file_path
            local_file.parent.mkdir(parents=True, exist_ok=True)
            local_file.write_bytes(content)
        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.upload_skill_file(self.use_case, skill_name, file_path, content)

    async def remove_skill_file(self, skill_name: str, file_path: str) -> bool:
        """Delete a file from a skill folder (local + blob)."""
        skill = self.skills.get(skill_name)
        if not skill:
            return False
        if skill.local_path:
            local_file = Path(skill.local_path) / file_path
            if local_file.is_file():
                local_file.unlink()
        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.delete_skill_file(self.use_case, skill_name, file_path)
        return True

    # ─── Admin operations ─────────────────────────────────────────────────

    async def update_skill(self, name: str, updates: dict) -> SkillMetadata | None:
        """Update a skill in the registry and persist to blob via SKILL.md."""
        skill = self.skills.get(name)
        if not skill:
            return None

        if "enabled" in updates:
            skill.enabled = updates["enabled"]

        if "instructions" in updates:
            skill.instructions = updates["instructions"]
            fm, _ = _parse_frontmatter(skill.instructions)
            if fm.get("description"):
                skill.description = fm["description"]

        if "description" in updates:
            skill.description = updates["description"]

        # Ensure frontmatter reflects current state
        skill.instructions = _update_frontmatter(
            skill.instructions,
            name=skill.name,
            description=skill.description,
            enabled=skill.enabled,
        )

        self.skills[name] = skill

        # Persist SKILL.md to blob
        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.upload_skill_file(
                self.use_case, name, "SKILL.md", skill.instructions.encode()
            )

        # Update local copy
        if skill.local_path:
            local_dir = Path(skill.local_path)
            local_dir.mkdir(parents=True, exist_ok=True)
            (local_dir / "SKILL.md").write_text(skill.instructions)

        return skill

    async def add_skill(self, skill: SkillMetadata) -> SkillMetadata:
        """Add a new skill to the registry and persist to blob via SKILL.md."""
        if skill.instructions:
            fm, _ = _parse_frontmatter(skill.instructions)
            if fm.get("description"):
                skill.description = fm["description"]

        # Ensure frontmatter contains all metadata
        skill.instructions = _update_frontmatter(
            skill.instructions,
            name=skill.name,
            description=skill.description,
            enabled=skill.enabled,
        )

        # Set local path
        if self._blob_service and self._blob_service.is_available:
            skill.local_path = str(self._blob_service.local_dir(self.use_case) / "skills" / skill.name)
        else:
            skill.local_path = str(Path("use-cases") / self.use_case / "skills" / skill.name)

        self.skills[skill.name] = skill

        # Persist SKILL.md to blob
        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.upload_skill_file(
                self.use_case, skill.name, "SKILL.md", skill.instructions.encode()
            )

        # Write local copy
        local_dir = Path(skill.local_path)
        local_dir.mkdir(parents=True, exist_ok=True)
        (local_dir / "SKILL.md").write_text(skill.instructions)

        logger.info("Added skill: %s/%s", self.use_case, skill.name)
        return skill

    async def remove_skill(self, name: str) -> bool:
        """Remove a skill from the registry and blob storage."""
        if name not in self.skills:
            return False

        del self.skills[name]

        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.delete_skill(name)

        logger.info("Removed skill: %s", name)
        return True

    async def update_mcp_servers(self, servers: dict) -> None:
        """Persist the MCP servers config as .mcp.json (local + blob)."""
        self.mcp_servers = servers
        content = json.dumps(servers, indent=2).encode()

        # Write to local filesystem so in-process sessions can reload
        if self._blob_service and self._blob_service.is_available:
            local_path = self._blob_service.local_dir(self.use_case) / ".mcp.json"
        else:
            local_path = Path("use-cases") / self.use_case / ".mcp.json"

        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)

        # Upload to blob so it persists across restarts
        if self._blob_service and self._blob_service.is_available:
            await self._blob_service.upload_mcp_config(self.use_case, content)

        logger.info("MCP servers config updated for use-case '%s': %d servers", self.use_case, len(servers))
