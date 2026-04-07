"""Blob Storage service for use-case and skill persistence.

Use-cases are stored as folder trees in Azure Blob Storage:
  use-cases/{use-case}/SYSTEM_PROMPT.md
  use-cases/{use-case}/skills/{skill-name}/SKILL.md
  use-cases/{use-case}/skills/{skill-name}/scripts/...

All skill metadata (name, description, enabled) lives in the SKILL.md YAML
frontmatter.  Each use-case has its own system prompt and skill set.

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

_USE_CASES_PREFIX = "use-cases/"


class BlobSkillService:
    """Manages use-case and skill storage in Azure Blob Storage."""

    def __init__(self, settings: Settings, local_base_dir: str = "use-cases") -> None:
        self.settings = settings
        self.local_base_dir = Path(local_base_dir)
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

    def local_dir(self, use_case: str) -> Path:
        """Return the local directory for a specific use-case."""
        return self.local_base_dir / use_case

    # ─── Use-case operations ──────────────────────────────────────────────

    async def list_use_cases(self) -> list[str]:
        """Return a list of use-case names (top-level folders under use-cases/)."""
        if not self._container_client:
            return []
        names: set[str] = set()
        async for blob in self._container_client.list_blobs(name_starts_with=_USE_CASES_PREFIX):
            parts = blob.name.removeprefix(_USE_CASES_PREFIX).split("/")
            if parts and parts[0]:
                names.add(parts[0])
        return sorted(names)

    async def download_system_prompt(self, use_case: str) -> str | None:
        """Download the SYSTEM_PROMPT.md for a use-case."""
        content = await self._download_file(f"{_USE_CASES_PREFIX}{use_case}/SYSTEM_PROMPT.md")
        return content.decode() if content else None

    # ─── Skill read operations ────────────────────────────────────────────

    async def list_skill_names(self, use_case: str) -> list[str]:
        """Return skill names for a specific use-case."""
        if not self._container_client:
            return []
        prefix = f"{_USE_CASES_PREFIX}{use_case}/skills/"
        names: set[str] = set()
        async for blob in self._container_client.list_blobs(name_starts_with=prefix):
            parts = blob.name.removeprefix(prefix).split("/")
            if parts and parts[0]:
                names.add(parts[0])
        return sorted(names)

    async def download_skill_file(self, use_case: str, skill_name: str, relative_path: str) -> bytes | None:
        """Download a single file from a skill folder."""
        blob_path = f"{_USE_CASES_PREFIX}{use_case}/skills/{skill_name}/{relative_path}"
        return await self._download_file(blob_path)

    async def sync_to_local(self, use_case: str) -> None:
        """Download all files for a use-case from blob to local filesystem."""
        if not self._container_client:
            return

        prefix = f"{_USE_CASES_PREFIX}{use_case}/"
        local = self.local_dir(use_case)
        local.mkdir(parents=True, exist_ok=True)
        count = 0

        async for blob in self._container_client.list_blobs(name_starts_with=prefix):
            relative = blob.name.removeprefix(prefix)
            if not relative:
                continue

            blob_client = self._container_client.get_blob_client(blob.name)
            stream = await blob_client.download_blob()
            content = await stream.readall()

            local_path = local / relative
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(content)

            if relative.endswith("SKILL.md"):
                count += 1

        logger.info("Synced use-case '%s': %d skills to %s", use_case, count, local)

    # ─── Write operations ─────────────────────────────────────────────────

    async def upload_file(self, blob_path: str, content: bytes) -> None:
        """Upload a file to an arbitrary blob path."""
        if not self._container_client:
            return
        blob = self._container_client.get_blob_client(blob_path)
        await blob.upload_blob(content, overwrite=True)

    async def upload_skill_file(self, use_case: str, skill_name: str, relative_path: str, content: bytes) -> None:
        """Upload a single file to a skill folder within a use-case."""
        blob_path = f"{_USE_CASES_PREFIX}{use_case}/skills/{skill_name}/{relative_path}"
        await self.upload_file(blob_path, content)

    async def upload_skill_folder(self, use_case: str, skill_name: str, local_folder: Path) -> None:
        """Upload an entire local skill folder to blob."""
        if not self._container_client:
            return
        for local_path in local_folder.rglob("*"):
            if local_path.is_file():
                relative = str(local_path.relative_to(local_folder))
                await self.upload_skill_file(use_case, skill_name, relative, local_path.read_bytes())
        logger.info("Uploaded skill folder: %s/%s", use_case, skill_name)

    async def delete_skill(self, use_case: str, skill_name: str) -> None:
        """Delete all blobs for a skill within a use-case."""
        if not self._container_client:
            return
        prefix = f"{_USE_CASES_PREFIX}{use_case}/skills/{skill_name}/"
        async for blob in self._container_client.list_blobs(name_starts_with=prefix):
            blob_client = self._container_client.get_blob_client(blob.name)
            await blob_client.delete_blob()
        logger.info("Deleted skill from blob: %s/%s", use_case, skill_name)

    async def delete_skill_file(self, use_case: str, skill_name: str, file_path: str) -> None:
        """Delete a single file from a skill folder in blob storage."""
        if not self._container_client:
            return
        blob_path = f"{_USE_CASES_PREFIX}{use_case}/skills/{skill_name}/{file_path}"
        try:
            blob = self._container_client.get_blob_client(blob_path)
            await blob.delete_blob()
        except Exception:
            pass  # Already deleted or doesn't exist

    async def upload_mcp_config(self, use_case: str, content: bytes) -> None:
        """Upload the .mcp.json config for a use-case."""
        blob_path = f"{_USE_CASES_PREFIX}{use_case}/.mcp.json"
        await self.upload_file(blob_path, content)

    # ─── Internal helpers ─────────────────────────────────────────────────

    async def _download_file(self, blob_path: str) -> bytes | None:
        """Download a single blob by path."""
        if not self._container_client:
            return None
        try:
            blob = self._container_client.get_blob_client(blob_path)
            stream = await blob.download_blob()
            return await stream.readall()
        except Exception:
            return None

    async def close(self) -> None:
        """Clean up resources."""
        if self._container_client:
            await self._container_client.close()
        if self._credential:
            await self._credential.close()
