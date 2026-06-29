"""Tests for the voice (GPT Realtime) session endpoint."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings


@pytest.fixture
def client():
    from app.main import app

    app.state.cosmos_service = MagicMock()
    app.state.skill_registry = MagicMock()
    app.state.copilot_agent = MagicMock()
    return TestClient(app, raise_server_exceptions=False)


def test_voice_disabled_returns_404(client):
    get_settings.cache_clear()
    client.app.dependency_overrides.clear()
    response = client.get("/api/voice/session")
    assert response.status_code == 404
    get_settings.cache_clear()


def test_voice_session_returns_ephemeral_token(client, monkeypatch):
    from app.routers import voice

    monkeypatch.setattr(
        voice,
        "get_settings",
        lambda: Settings(
            voice_enabled=True,
            voice_endpoint="https://acct.cognitiveservices.azure.com/",
            voice_deployment="gpt-realtime",
            voice_voice="marin",
        ),
    )

    cred = MagicMock()
    cred.get_token = AsyncMock(return_value=MagicMock(token="aad-tok"))  # noqa: S106
    monkeypatch.setattr(voice, "_get_credential", lambda: cred)

    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value={"value": "ephem-123", "expires_at": 999})
    http = MagicMock()
    http.post = AsyncMock(return_value=resp)
    monkeypatch.setattr(voice, "_get_http_client", lambda: http)

    response = client.get("/api/voice/session")
    assert response.status_code == 200
    body = response.json()
    assert body["token"] == "ephem-123"  # noqa: S105
    assert body["deployment"] == "gpt-realtime"
    assert body["voice"] == "marin"
    assert body["endpoint"] == "https://acct.cognitiveservices.azure.com"

    called_url = http.post.call_args[0][0]
    assert called_url.endswith("/openai/v1/realtime/client_secrets")
