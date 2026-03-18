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
        self._settings_container: Any = None
        self._sessions_container: Any = None

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

        # Settings container — stores system prompt and other config
        try:
            self._settings_container = database.get_container_client("settings")
            await self._settings_container.read()
        except Exception:
            logger.warning("Settings container not found in Cosmos — using defaults")
            self._settings_container = None

        # Sessions container — stores SDK session ID ↔ conversation ID mapping
        try:
            self._sessions_container = database.get_container_client("sessions")
            await self._sessions_container.read()
        except Exception:
            logger.warning("Sessions container not found in Cosmos — session resume disabled")
            self._sessions_container = None

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

    # ─── Settings ─────────────────────────────────────────────────────────────

    async def get_setting(self, setting_id: str) -> dict | None:
        """Read a setting by id. Partition key is /category."""
        if not self._settings_container:
            return None
        try:
            return await self._settings_container.read_item(
                item=setting_id, partition_key="system"
            )
        except Exception:
            return None

    async def upsert_setting(self, setting: dict) -> dict:
        """Create or update a setting document."""
        if not self._settings_container:
            return setting
        await self._settings_container.upsert_item(setting)
        return setting

    async def delete_setting(self, setting_id: str) -> None:
        """Delete a setting document by id."""
        if not self._settings_container:
            return
        try:
            await self._settings_container.delete_item(
                item=setting_id, partition_key="system"
            )
        except Exception:
            pass

    # ─── Sessions (SDK session ID mapping) ────────────────────────────────────

    async def upsert_session_mapping(self, conversation_id: str, sdk_session_id: str) -> None:
        """Store the SDK session ID for a conversation."""
        if not self._sessions_container:
            return
        doc = {
            "id": conversation_id,
            "conversationId": conversation_id,
            "sdkSessionId": sdk_session_id,
        }
        await self._sessions_container.upsert_item(doc)

    async def get_session_mapping(self, conversation_id: str) -> str | None:
        """Return the SDK session ID for a conversation, or None."""
        if not self._sessions_container:
            return None
        try:
            item = await self._sessions_container.read_item(
                item=conversation_id, partition_key=conversation_id
            )
            return item.get("sdkSessionId")
        except Exception:
            return None

    async def delete_session_mapping(self, conversation_id: str) -> None:
        """Delete the session mapping for a conversation."""
        if not self._sessions_container:
            return
        try:
            await self._sessions_container.delete_item(
                item=conversation_id, partition_key=conversation_id
            )
        except Exception:
            pass

    async def delete_all_session_mappings(self) -> None:
        """Delete all stored SDK session mappings (called on prompt/config resets)."""
        if not self._sessions_container:
            return
        try:
            items = self._sessions_container.query_items(
                query="SELECT c.id, c.conversationId FROM c",
                enable_cross_partition_query=True,
            )
            async for item in items:
                try:
                    await self._sessions_container.delete_item(
                        item=item["id"], partition_key=item["conversationId"]
                    )
                except Exception:
                    pass
        except Exception:
            logger.warning("Failed to purge all session mappings from Cosmos", exc_info=True)
