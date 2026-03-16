"""Blob Storage service for skill persistence.

Skills are stored as folder trees in Azure Blob Storage:
  skills/{skill-name}/SKILL.md
  skills/{skill-name}/scripts/...

All metadata (name, description, enabled) lives in the SKILL.md YAML
frontmatter — no separate metadata file needed.

On startup the registry syncs blob → local filesystem so the Copilot SDK
can read SKILL.md files from disk.  The admin API writes back to blob.
Uses Azure Managed Identity for passwordless authentication.
"""

import logging
from pathlib import Path

from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import ContainerClient

from app.config import Settings

logger = logging.getLogger(__name__)

_SKILLS_PREFIX = "skills/"


class BlobSkillService:
    """Manages skill storage in Azure Blob Storage."""

    def __init__(self, settings: Settings, local_skills_dir: str = "/tmp/skills") -> None:  # noqa: S108
        self.settings = settings
        self.local_dir = Path(local_skills_dir)
        self._container_client: ContainerClient | None = None
        self._credential: DefaultAzureCredential | None = None

    async def initialize(self) -> None:
        """Initialize the blob container client."""
        endpoint = self.settings.blob_storage_endpoint
        container = self.settings.blob_skills_container
        if not endpoint:
            logger.warning("Blob storage endpoint not configured — skill persistence disabled")
            return

        self._credential = DefaultAzureCredential()
        self._container_client = ContainerClient(
            account_url=endpoint,
            container_name=container,
            credential=self._credential,
        )
        logger.info("Blob skill service initialized — endpoint=%s container=%s", endpoint, container)

    @property
    def is_available(self) -> bool:
        return self._container_client is not None

    # ─── Read operations ──────────────────────────────────────────────────

    async def list_skill_names(self) -> list[str]:
        """Return a list of skill names (top-level folders under skills/)."""
        if not self._container_client:
            return []
        names: set[str] = set()
        async for blob in self._container_client.list_blobs(name_starts_with=_SKILLS_PREFIX):
            # skills/web-search/SKILL.md → web-search
            parts = blob.name.removeprefix(_SKILLS_PREFIX).split("/")
            if parts and parts[0]:
                names.add(parts[0])
        return sorted(names)

    async def download_skill_file(self, skill_name: str, relative_path: str) -> bytes | None:
        """Download a single file from a skill folder."""
        if not self._container_client:
            return None
        blob_path = f"{_SKILLS_PREFIX}{skill_name}/{relative_path}"
        try:
            blob = self._container_client.get_blob_client(blob_path)
            stream = await blob.download_blob()
            return await stream.readall()
        except Exception:
            return None

    async def sync_to_local(self) -> None:
        """Download all skill folders from blob to local filesystem."""
        if not self._container_client:
            return

        self.local_dir.mkdir(parents=True, exist_ok=True)
        count = 0

        async for blob in self._container_client.list_blobs(name_starts_with=_SKILLS_PREFIX):
            relative = blob.name.removeprefix(_SKILLS_PREFIX)
            parts = relative.split("/", 1)
            if len(parts) < 2 or not parts[0]:
                continue
            skill_name, file_path = parts[0], parts[1]

            blob_client = self._container_client.get_blob_client(blob.name)
            stream = await blob_client.download_blob()
            content = await stream.readall()

            local_path = self.local_dir / skill_name / file_path
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(content)

            if file_path == "SKILL.md":
                count += 1

        logger.info("Synced %d skills from blob to %s", count, self.local_dir)

    # ─── Write operations ─────────────────────────────────────────────────

    async def upload_skill_file(self, skill_name: str, relative_path: str, content: bytes) -> None:
        """Upload a single file to a skill folder."""
        if not self._container_client:
            return
        blob_path = f"{_SKILLS_PREFIX}{skill_name}/{relative_path}"
        blob = self._container_client.get_blob_client(blob_path)
        await blob.upload_blob(content, overwrite=True)

    async def upload_skill_folder(self, skill_name: str, local_folder: Path) -> None:
        """Upload an entire local skill folder to blob."""
        if not self._container_client:
            return
        for local_path in local_folder.rglob("*"):
            if local_path.is_file():
                relative = str(local_path.relative_to(local_folder))
                await self.upload_skill_file(skill_name, relative, local_path.read_bytes())
        logger.info("Uploaded skill folder: %s", skill_name)

    async def delete_skill(self, skill_name: str) -> None:
        """Delete all blobs for a skill."""
        if not self._container_client:
            return
        prefix = f"{_SKILLS_PREFIX}{skill_name}/"
        async for blob in self._container_client.list_blobs(name_starts_with=prefix):
            blob_client = self._container_client.get_blob_client(blob.name)
            await blob_client.delete_blob()
        logger.info("Deleted skill from blob: %s", skill_name)

    # ─── Seed from local baked-in skills ──────────────────────────────────

    async def seed_from_local(self, skills_dir: str = "skills") -> int:
        """Upload baked-in skills from the container image to blob (first-run).

        Only uploads skills that don't already exist in blob.
        Ensures each SKILL.md has an `enabled: true` frontmatter field.
        Returns the number of skills seeded.
        """
        if not self._container_client:
            return 0

        existing = set(await self.list_skill_names())
        local = Path(skills_dir)
        if not local.exists():
            return 0

        seeded = 0
        for skill_dir in sorted(local.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_name = skill_dir.name
            if skill_name in existing:
                continue

            # Ensure SKILL.md has enabled field in frontmatter before uploading
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                content = skill_md.read_text()
                content = _ensure_enabled_frontmatter(content, skill_name)
                skill_md.write_text(content)

            await self.upload_skill_folder(skill_name, skill_dir)
            seeded += 1

        if seeded:
            logger.info("Seeded %d skills to blob storage", seeded)
        return seeded

    async def close(self) -> None:
        """Clean up resources."""
        if self._container_client:
            await self._container_client.close()
        if self._credential:
            await self._credential.close()


def _ensure_enabled_frontmatter(text: str, skill_name: str) -> str:
    """Ensure SKILL.md has 'enabled' in its YAML frontmatter.

    If frontmatter exists but lacks 'enabled', adds it as true.
    If no frontmatter exists, creates one with name and enabled: true.
    """
    import re

    import yaml

    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.DOTALL)
    if match:
        try:
            fm = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            fm = {}
        if "enabled" not in fm:
            fm["enabled"] = True
            fm_str = yaml.dump(fm, default_flow_style=False, sort_keys=False).strip()
            body = text[match.end():]
            return f"---\n{fm_str}\n---\n\n{body.lstrip()}"
        return text

    # No frontmatter at all — create one
    fm = {"name": skill_name, "enabled": True}
    fm_str = yaml.dump(fm, default_flow_style=False, sort_keys=False).strip()
    return f"---\n{fm_str}\n---\n\n{text.lstrip()}"
