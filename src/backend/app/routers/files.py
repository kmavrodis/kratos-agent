"""File download endpoint — serves files created by the agent on the container."""

import logging
import mimetypes
import os

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Directories the agent is allowed to write to and we are allowed to serve from.
_ALLOWED_ROOTS = ("/tmp",)


def _is_safe_path(requested: str) -> bool:
    """Return True if the resolved path lives under an allowed root."""
    resolved = os.path.realpath(requested)
    return any(resolved.startswith(root + os.sep) or resolved == root for root in _ALLOWED_ROOTS)


@router.get("/download/{filename}")
async def download_file(
    filename: str,
    path: str = Query(..., description="Absolute path of the file on the server"),
) -> FileResponse:
    """Serve a file the agent created so the user can download it."""
    resolved = os.path.realpath(path)

    if not _is_safe_path(resolved):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.isfile(resolved):
        raise HTTPException(status_code=404, detail="File not found")

    media_type = mimetypes.guess_type(resolved)[0] or "application/octet-stream"
    safe_name = os.path.basename(resolved)

    return FileResponse(
        path=resolved,
        media_type=media_type,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
