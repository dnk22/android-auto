from __future__ import annotations

from fastapi import APIRouter

from app.models.api import HealthResponse



def build_router():
    router = APIRouter(tags=["health"])

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(ok=True, service="backend-orchestrator")

    return router
