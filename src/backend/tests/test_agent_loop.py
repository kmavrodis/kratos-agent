"""Tests for the agent loop."""

import pytest

from app.models import ContentEvent, Message, MessageRole, ThoughtEvent
from app.services.agent_loop import AgentLoop
from app.services.skill_registry import SkillRegistry
from app.config import Settings


@pytest.fixture
def settings():
    return Settings(
        foundry_endpoint="",
        foundry_model_deployment="gpt-4o",
    )


@pytest.fixture
def skill_registry(tmp_path):
    config = tmp_path / "skills.yaml"
    config.write_text("""
skills:
  - name: web-search
    description: Internet search
    enabled: true
    path: ./skills/web-search
""")
    return SkillRegistry(config_path=str(config))


@pytest.mark.asyncio
async def test_agent_loop_without_foundry(skill_registry, settings):
    """Test that the agent loop works without a Foundry endpoint (fallback mode)."""
    await skill_registry.load()
    loop = AgentLoop(skill_registry=skill_registry, settings=settings)

    events = []
    async for event in loop.run(
        message="Hello, how are you?",
        history=[],
        conversation_id="test-conv-1",
    ):
        events.append(event)

    # Should have at least a thought and content events
    assert any(isinstance(e, ThoughtEvent) for e in events)
    assert any(isinstance(e, ContentEvent) for e in events)


@pytest.mark.asyncio
async def test_agent_loop_with_history(skill_registry, settings):
    """Test that history is properly included in context."""
    await skill_registry.load()
    loop = AgentLoop(skill_registry=skill_registry, settings=settings)

    history = [
        Message(
            id="msg-1",
            conversationId="test-conv-1",
            role=MessageRole.USER,
            content="What is Azure?",
            createdAt="2025-01-01T00:00:00Z",
        ),
        Message(
            id="msg-2",
            conversationId="test-conv-1",
            role=MessageRole.ASSISTANT,
            content="Azure is Microsoft's cloud computing platform.",
            createdAt="2025-01-01T00:00:01Z",
        ),
    ]

    events = []
    async for event in loop.run(
        message="Tell me more",
        history=history,
        conversation_id="test-conv-1",
    ):
        events.append(event)

    assert len(events) > 0
