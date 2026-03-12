"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "kratos-agent-service"}


@router.get("/health/ready")
async def readiness_check() -> dict[str, str]:
    return {"status": "ready"}
