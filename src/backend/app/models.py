"""Pydantic models for API request/response schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

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
    useCase: str = "generic"


class Conversation(BaseModel):
    id: str
    userId: str
    title: str
    useCase: str = "generic"
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


# ─── Attachments ───

class FileAttachment(BaseModel):
    type: Literal["file"] = "file"
    path: str
    displayName: str = ""
    content: str | None = None  # base64-encoded file content from browser uploads


class DirectoryAttachment(BaseModel):
    type: Literal["directory"] = "directory"
    path: str
    displayName: str = ""


class SelectionAttachment(BaseModel):
    type: Literal["selection"] = "selection"
    filePath: str
    displayName: str
    text: str = ""


Attachment = FileAttachment | DirectoryAttachment | SelectionAttachment


# ─── Agent ───

class AgentRequest(BaseModel):
    conversationId: str
    message: str
    useCase: str = "generic"
    attachments: list[Attachment] = Field(default_factory=list)


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


class UsageEvent(BaseModel):
    """Streamed event for token usage from a model turn."""
    type: str = "usage"
    promptTokens: int = 0
    completionTokens: int = 0
    reasoningTokens: int = 0
    totalTokens: int = 0


class DoneEvent(BaseModel):
    """Streamed event signaling completion."""
    type: str = "done"
    conversationId: str
    totalDurationMs: int = 0
    totalToolCalls: int = 0
    promptTokens: int = 0
    completionTokens: int = 0
    reasoningTokens: int = 0
    totalTokens: int = 0
    timeToFirstTokenMs: int = 0
    modelLatencyMs: int = 0


class ErrorEvent(BaseModel):
    """Streamed error event."""
    type: str = "error"
    message: str
    code: str = "UNKNOWN_ERROR"


class UserInputRequestEvent(BaseModel):
    """Streamed event when the agent asks the user a question."""
    type: str = "user_input_request"
    requestId: str
    question: str
    choices: list[str] = Field(default_factory=list)
    allowFreeform: bool = True


class UserInputResponseRequest(BaseModel):
    """Payload for responding to a user input request."""
    conversationId: str
    requestId: str
    answer: str


# ─── Settings ───

class AIServiceSettings(BaseModel):
    """AI service configuration submitted by the user."""
    aiServicesEndpoint: str = Field(default="", description="Azure AI Services endpoint URL")
    aiServicesModelDeployment: str = Field(default="gpt-52", description="Model deployment name")


class AIServiceStatus(BaseModel):
    """Current AI service config status."""
    configured: bool = False
    aiServicesEndpoint: str = ""
    aiServicesModelDeployment: str = ""
    code: str = "INTERNAL_ERROR"


# ─── Skills Admin ───

class SkillResponse(BaseModel):
    """Skill as returned by the admin API."""
    name: str
    description: str
    enabled: bool = True
    instructions: str = ""
    toolName: str = ""


class SkillCreate(BaseModel):
    """Payload for creating a new skill."""
    name: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9\-]*$")
    description: str = Field(default="", max_length=500)
    enabled: bool = True
    instructions: str = Field(default="", max_length=10000)


class SkillUpdate(BaseModel):
    """Payload for updating a skill. All fields optional."""
    description: str | None = Field(default=None, max_length=500)
    enabled: bool | None = None
    instructions: str | None = Field(default=None, max_length=10000)


class SkillList(BaseModel):
    """List of skills."""
    skills: list[SkillResponse]


# ─── System Prompt Admin ───

class UseCaseInfo(BaseModel):
    """Use-case metadata as returned by the API."""
    name: str
    displayName: str = ""
    description: str = ""
    skillCount: int = 0


class UseCaseList(BaseModel):
    """List of available use-cases."""
    useCases: list[UseCaseInfo]


class SystemPromptResponse(BaseModel):
    """System prompt as returned by the admin API."""
    content: str
    isDefault: bool = False


class SystemPromptUpdate(BaseModel):
    """Payload for updating the system prompt."""
    content: str = Field(..., min_length=1, max_length=50000)
