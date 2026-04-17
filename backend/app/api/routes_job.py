import asyncio
import uuid

from fastapi import APIRouter, HTTPException

from app.core.automation.shopee_bot import ShopeeBot
from app.services.device_manager import device_manager
from app.models.schemas import JobResponse, StartJobRequest

router = APIRouter()


@router.post("/start", response_model=JobResponse)
async def start_job(req: StartJobRequest) -> JobResponse:
    if req.device_id and not device_manager.is_u2_alive(req.device_id, force_refresh=True):
        raise HTTPException(status_code=400, detail="Device is not reachable")

    job_id = str(uuid.uuid4())
    bot = ShopeeBot(device_id=req.device_id)
    asyncio.create_task(bot.run())
    return JobResponse(job_id=job_id, status="started")
