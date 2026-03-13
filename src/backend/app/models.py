"""Pydantic models for API request/response schemas."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Enums ───

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


# ─── Conversations ───

class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class Conversation(BaseModel):
    id: str
    userId: str
    title: str
    status: ConversationStatus = ConversationStatus.ACTIVE
    createdAt: datetime
    updatedAt: datetime


class ConversationList(BaseModel):
    conversations: list[Conversation]


# ─── Messages ───

class Message(BaseModel):
    id: str
    conversationId: str
    role: MessageRole
    content: str
    toolCalls: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: datetime


class MessageCreate(BaseModel):
    content: str


# ─── Agent ───

class AgentRequest(BaseModel):
    conversationId: str
    message: str


class ToolCallEvent(BaseModel):
    """Streamed event for tool call progress."""
    type: str = "tool_call"
    skillName: str
    status: str  # "started", "completed", "failed"
    input: str = ""
    output: str = ""
    durationMs: int = 0


class ThoughtEvent(BaseModel):
    """Streamed event for agent reasoning."""
    type: str = "thought"
    content: str
    iteration: int = 0


class ContentEvent(BaseModel):
    """Streamed event for response content."""
    type: str = "content"
    content: str


class DoneEvent(BaseModel):
    """Streamed event signaling completion."""
    type: str = "done"
    conversationId: str
    totalDurationMs: int = 0
    totalToolCalls: int = 0


class ErrorEvent(BaseModel):
    """Streamed error event."""
    type: str = "error"
    message: str
    code: str = "UNKNOWN_ERROR"


# ─── Settings ───

class BYOKSettings(BaseModel):
    """BYOK configuration submitted by the user."""
    foundryEndpoint: str = Field(default="", description="Azure Foundry endpoint URL")
    foundryModelDeployment: str = Field(default="gpt-4o", description="Model deployment name")
    foundryApiKey: str = Field(default="", description="Foundry API key")


class BYOKStatus(BaseModel):
    """Current BYOK config status (key is never exposed)."""
    configured: bool = False
    foundryEndpoint: str = ""
    foundryModelDeployment: str = ""
    code: str = "INTERNAL_ERROR"
