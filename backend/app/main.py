import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_device import router as device_router
from app.api.routes_job import router as job_router
from app.api.routes_ws import router as ws_router
from app.services.device_monitor import DeviceMonitor
from app.services.device_realtime import device_ws_manager

app = FastAPI(title="Android Automation Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(device_router)
app.include_router(job_router)
app.include_router(ws_router)

device_monitor_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup_event() -> None:
    global device_monitor_task
    if device_monitor_task is None or device_monitor_task.done():
        monitor = DeviceMonitor(device_ws_manager)
        device_monitor_task = asyncio.create_task(
            monitor.run()
        )


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global device_monitor_task
    if device_monitor_task is None:
        return
    device_monitor_task.cancel()
    try:
        await device_monitor_task
    except asyncio.CancelledError:
        pass
    device_monitor_task = None


@app.get("/")
async def root():
    return {"status": "ok"}
