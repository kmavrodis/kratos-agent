"""Traces API — App Insights waterfall queries for the Traces panel.

Endpoints:
    GET /api/traces/operations
    GET /api/traces/operations/{operation_id}
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.auth import require_authenticated_user
from app.models import TraceList, TraceOperation
from app.services.traces_service import TracesService

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_authenticated_user)])


def _get_service(request: Request) -> TracesService:
    svc: TracesService | None = getattr(request.app.state, "traces_service", None)
    if svc is None:
        raise HTTPException(status_code=503, detail="Traces service is not initialized")
    return svc


@router.get("/operations", response_model=TraceList)
async def list_operations(
    request: Request,
    use_case: str | None = Query(default=None),
    conversation_id: str | None = Query(default=None),
    eval_run_id: str | None = Query(default=None),
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=50, ge=1, le=200),
) -> TraceList:
    service = _get_service(request)
    return await service.fetch_operations(
        use_case=use_case,
        conversation_id=conversation_id,
        eval_run_id=eval_run_id,
        lookback_hours=hours,
        max_operations=limit,
    )


@router.get("/operations/{operation_id}", response_model=TraceOperation)
async def get_operation(
    operation_id: str,
    request: Request,
    hours: int = Query(default=168, ge=1, le=2160),
) -> TraceOperation:
    service = _get_service(request)
    op = await service.fetch_operation(operation_id, lookback_hours=hours)
    if op is None:
        raise HTTPException(status_code=404, detail=f"Operation '{operation_id}' not found")
    return op
