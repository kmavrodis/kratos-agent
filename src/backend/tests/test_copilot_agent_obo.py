"""Tests for per-conversation OBO MCP token injection in CopilotAgent.

Covers set_conversation_mcp_tokens + _apply_mcp_tokens — the hook that injects
the signed-in user's bearer into the remote OBO MCP server's transport headers
so the tool runs On-Behalf-Of the user. The token must never mutate the shared
registry config and must only land on the matching server.
"""

import pytest

from app.config import Settings
from app.services.copilot_agent import CopilotAgent


@pytest.fixture
def settings():
    return Settings(
        foundry_endpoint="https://test.services.ai.azure.com",
        foundry_model_deployment="gpt-52",
    )


@pytest.fixture
def agent(settings):
    return CopilotAgent(settings)


def test_inject_header_on_registry_server(agent):
    """A token whose key matches a configured server sets its Authorization header."""
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": "tok-abc"})
    registry = {"graph-obo": {"type": "http", "url": "https://obo.example/mcp", "tools": ["*"]}}

    result = agent._apply_mcp_tokens("conv1", registry)

    assert result["graph-obo"]["headers"]["Authorization"] == "Bearer tok-abc"
    # original registry dict is untouched (deep copy)
    assert "headers" not in registry["graph-obo"]


def test_autocreate_obo_server_from_env(agent, monkeypatch):
    """With no registry entry, the known OBO server is created from env config."""
    monkeypatch.setenv("OBO_MCP_SERVER_NAME", "graph-obo")
    monkeypatch.setenv("OBO_MCP_SERVER_MCP_URL", "https://obo.example/mcp")
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": "tok-xyz"})

    result = agent._apply_mcp_tokens("conv1", {})

    entry = result["graph-obo"]
    assert entry["type"] == "http"
    assert entry["url"] == "https://obo.example/mcp"
    assert entry["headers"]["Authorization"] == "Bearer tok-xyz"


def test_autocreate_skipped_without_url(agent, monkeypatch):
    """No URL configured => the OBO server is not fabricated."""
    monkeypatch.setenv("OBO_MCP_SERVER_NAME", "graph-obo")
    monkeypatch.delenv("OBO_MCP_SERVER_MCP_URL", raising=False)
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": "tok-xyz"})

    result = agent._apply_mcp_tokens("conv1", {})

    assert "graph-obo" not in result


def test_unknown_server_token_ignored(agent, monkeypatch):
    """A token for a server that is neither configured nor the OBO server is ignored."""
    monkeypatch.setenv("OBO_MCP_SERVER_NAME", "graph-obo")
    monkeypatch.setenv("OBO_MCP_SERVER_MCP_URL", "https://obo.example/mcp")
    agent.set_conversation_mcp_tokens("conv1", {"mystery": "tok"})

    result = agent._apply_mcp_tokens("conv1", {})

    assert "mystery" not in result


def test_no_tokens_is_noop(agent):
    """No registered tokens => servers returned unchanged, no Authorization added."""
    registry = {"graph-obo": {"type": "http", "url": "https://obo.example/mcp"}}

    result = agent._apply_mcp_tokens("conv-none", registry)

    assert "headers" not in result["graph-obo"]


def test_empty_dict_clears_tokens(agent):
    """Passing an empty dict removes previously registered tokens."""
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": "tok-abc"})
    agent.set_conversation_mcp_tokens("conv1", {})
    registry = {"graph-obo": {"type": "http", "url": "https://obo.example/mcp"}}

    result = agent._apply_mcp_tokens("conv1", registry)

    assert "headers" not in result["graph-obo"]


def test_empty_token_value_not_injected(agent):
    """A falsy token value must not produce a 'Bearer ' header."""
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": ""})
    registry = {"graph-obo": {"type": "http", "url": "https://obo.example/mcp"}}

    result = agent._apply_mcp_tokens("conv1", registry)

    assert "headers" not in result["graph-obo"]


def test_tokens_isolated_per_conversation(agent):
    """Tokens registered for one conversation never leak into another."""
    agent.set_conversation_mcp_tokens("conv1", {"graph-obo": "tok-1"})
    registry = {"graph-obo": {"type": "http", "url": "https://obo.example/mcp"}}

    other = agent._apply_mcp_tokens("conv2", registry)

    assert "headers" not in other["graph-obo"]
