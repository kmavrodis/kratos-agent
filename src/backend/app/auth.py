"""Lightweight authentication dependency for admin endpoints.

In production, Azure Static Web Apps (Easy Auth) injects the
``x-ms-client-principal`` header for authenticated users.  Container Apps
can also be configured with Easy Auth.

Auth enforcement is opt-in via the ADMIN_AUTH_ENABLED env var.  Set it to
"true" after configuring Easy Auth on your Container App or SWA.
"""

import base64
import json
import logging

from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _get_client_principal(request: Request) -> dict | None:
    """Decode the SWA / Easy Auth client-principal header if present."""
    header = request.headers.get("x-ms-client-principal")
    if not header:
        return None
    try:
        decoded = base64.b64decode(header)
        return json.loads(decoded)
    except Exception:
        logger.warning("Failed to decode x-ms-client-principal header")
        return None


_settings_dep = Depends(get_settings)


async def require_authenticated_user(
    request: Request,
    settings: Settings = _settings_dep,
) -> dict:
    """FastAPI dependency that enforces authentication.

    Returns the decoded client-principal dict on success.
    When admin_auth_enabled is not "true", returns a stub identity
    (auth is opt-in until Easy Auth is configured).
    """
    if settings.admin_auth_enabled.lower() != "true":
        return {"userId": "anonymous", "userRoles": ["authenticated", "admin"]}

    principal = _get_client_principal(request)
    if not principal:
        raise HTTPException(status_code=401, detail="Authentication required")

    return principal
