"""Cosmos DB service for conversation, message, and skill persistence.

Uses Azure Managed Identity for passwordless authentication.
Partition keys: conversations -> /userId, messages -> /conversationId, skills -> /name
"""

import logging
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from app.config import Settings
from app.models import Conversation, Message

logger = logging.getLogger(__name__)


class CosmosService:
    """Manages conversation, message, and skill persistence in Azure Cosmos DB."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: CosmosClient | None = None
        self._conversations_container: Any = None
        self._messages_container: Any = None
        self._skills_container: Any = None

    async def initialize(self) -> None:
        """Initialize Cosmos DB client and containers."""
        if not self.settings.cosmos_db_endpoint:
            logger.warning("Cosmos DB endpoint not configured -- persistence disabled")
            return

        credential = DefaultAzureCredential()
        self._client = CosmosClient(self.settings.cosmos_db_endpoint, credential=credential)

        database = self._client.get_database_client(self.settings.cosmos_db_database)
        self._conversations_container = database.get_container_client("conversations")
        self._messages_container = database.get_container_client("messages")

        # Skills container may not exist yet (requires Bicep provision)
        try:
            self._skills_container = database.get_container_client("skills")
            # Verify it exists with a lightweight metadata read
            await self._skills_container.read()
        except Exception:
            logger.warning("Skills container not found in Cosmos — admin features disabled until provisioned")
            self._skills_container = None

        logger.info("Cosmos DB initialized -- database=%s", self.settings.cosmos_db_database)

    async def upsert_conversation(self, conversation: Conversation) -> None:
        if not self._conversations_container:
            return
        await self._conversations_container.upsert_item(conversation.model_dump(mode="json"))

    async def get_conversation(self, conversation_id: str, user_id: str) -> Conversation | None:
        if not self._conversations_container:
            return None
        try:
            item = await self._conversations_container.read_item(
                item=conversation_id, partition_key=user_id
            )
            return Conversation(**item)
        except Exception:
            return None

    async def list_conversations(self, user_id: str) -> list[Conversation]:
        if not self._conversations_container:
            return []
        query = "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.updatedAt DESC"
        params: list[dict[str, str]] = [{"name": "@userId", "value": user_id}]
        items = self._conversations_container.query_items(
            query=query, parameters=params, partition_key=user_id
        )
        return [Conversation(**item) async for item in items]

    async def delete_conversation(self, conversation_id: str, user_id: str) -> None:
        if not self._conversations_container:
            return
        await self._conversations_container.delete_item(
            item=conversation_id, partition_key=user_id
        )

    async def upsert_message(self, message: Message) -> None:
        if not self._messages_container:
            return
        await self._messages_container.upsert_item(message.model_dump(mode="json"))

    async def list_messages(self, conversation_id: str) -> list[Message]:
        if not self._messages_container:
            return []
        query = "SELECT * FROM c WHERE c.conversationId = @cid ORDER BY c.createdAt ASC"
        params: list[dict[str, str]] = [{"name": "@cid", "value": conversation_id}]
        items = self._messages_container.query_items(
            query=query, parameters=params, partition_key=conversation_id
        )
        return [Message(**item) async for item in items]

    # ─── Skills ───────────────────────────────────────────────────────────────

    async def upsert_skill(self, skill: dict) -> dict:
        """Create or update a skill document. Partition key is /name."""
        if not self._skills_container:
            return skill
        await self._skills_container.upsert_item(skill)
        return skill

    async def get_skill(self, skill_name: str) -> dict | None:
        """Read a skill by name (which is also the id and partition key)."""
        if not self._skills_container:
            return None
        try:
            return await self._skills_container.read_item(
                item=skill_name, partition_key=skill_name
            )
        except Exception:
            return None

    async def list_skills(self) -> list[dict]:
        """List all skills."""
        if not self._skills_container:
            return []
        query = "SELECT * FROM c ORDER BY c.name ASC"
        items = self._skills_container.query_items(
            query=query, enable_cross_partition_query=True
        )
        return [item async for item in items]

    async def delete_skill(self, skill_name: str) -> None:
        """Delete a skill document by name."""
        if not self._skills_container:
            return
        await self._skills_container.delete_item(
            item=skill_name, partition_key=skill_name
        )
