"""Voice (GPT Realtime) endpoint — mints ephemeral Realtime session tokens.

Loosely coupled, opt-in (``VOICE_ENABLED``) helper for the browser's
speech-to-speech mode. The Realtime API key never reaches the browser: the
backend authenticates with Managed Identity / ``DefaultAzureCredential`` and
returns a short-lived ephemeral token plus the public WebRTC target. The chat
path (``/api/agent/chat``) is unchanged — Realtime is used for STT + TTS only.
"""

import logging

import httpx
from azure.identity.aio import DefaultAzureCredential
from fastapi import APIRouter, HTTPException

from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()

_credential: DefaultAzureCredential | None = None
_http_client: httpx.AsyncClient | None = None


def _get_credential() -> DefaultAzureCredential:
    global _credential
    if _credential is None:
        _credential = DefaultAzureCredential()
    return _credential


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


@router.get("/session")
async def create_voice_session() -> dict:
    """Return an ephemeral Realtime session token + WebRTC target.

    The browser uses ``token`` to open a WebRTC call to
    ``{endpoint}/openai/v1/realtime/calls?model={deployment}`` — the long-lived
    key stays server-side. Gated behind ``VOICE_ENABLED``.
    """
    settings = get_settings()
    if not settings.voice_enabled:
        raise HTTPException(status_code=404, detail="Voice mode is disabled")

    endpoint = (settings.voice_endpoint or settings.foundry_endpoint).rstrip("/")
    if not endpoint:
        raise HTTPException(status_code=503, detail="Voice endpoint not configured")

    deployment = settings.voice_deployment
    voice = settings.voice_voice

    # Bake the session config at creation so the browser cannot inject a late
    # session.update race; STT + server-side VAD on, TTS voice fixed.
    session_config = {
        "session": {
            "type": "realtime",
            "model": deployment,
            "instructions": settings.voice_instructions,
            "audio": {
                "input": {
                    "transcription": {"model": "whisper-1"},
                    "turn_detection": {"type": "server_vad", "create_response": False},
                },
                "output": {"voice": voice},
            },
        }
    }

    try:
        token = await _get_credential().get_token(settings.voice_token_scope)
    except Exception as exc:  # pragma: no cover - infra failure
        logger.error("Voice token auth failed: %s", exc)
        raise HTTPException(status_code=503, detail="Authentication failed") from exc

    url = f"{endpoint}/openai/v1/realtime/client_secrets"
    headers = {"Authorization": f"Bearer {token.token}", "Content-Type": "application/json"}
    try:
        resp = await _get_http_client().post(url, headers=headers, json=session_config)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Voice session create failed: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create voice session") from exc

    data = resp.json()
    ephemeral = data.get("value") or data.get("client_secret", {}).get("value", "")
    if not ephemeral:
        logger.error("No ephemeral token in Realtime response: %s", data)
        raise HTTPException(status_code=502, detail="No ephemeral token returned")

    return {
        "token": ephemeral,
        "endpoint": endpoint,
        "deployment": deployment,
        "voice": voice,
        "expiresAt": data.get("expires_at"),
    }
