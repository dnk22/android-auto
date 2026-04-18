from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.core.config import load_settings
from app.core.state import AppContainer
from app.services.device.adb_watcher import AdbWatcher
from app.services.device.controller import DeviceController
from app.services.device.device_manager import DeviceManager
from app.services.logging.logger import JsonLogger
from app.services.media.media_client import MediaClient
from app.services.media.scheduler import MediaScheduler
from app.services.ws.ws_manager import WSManager



def _load_module(file_path: Path, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module: {file_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module



def _build_container() -> AppContainer:
    settings = load_settings()
    logger = JsonLogger()
    ws_manager = WSManager()
    media_client = MediaClient(settings)
    media_scheduler = MediaScheduler(settings.media_nodes)
    controller = DeviceController(logger)
    device_manager = DeviceManager(
        ws_manager=ws_manager,
        media_client=media_client,
        media_scheduler=media_scheduler,
        controller=controller,
        logger=logger,
        stale_after_sec=settings.stream_stale_after_sec,
        disconnect_grace_sec=settings.disconnect_grace_sec,
    )
    adb_watcher = AdbWatcher(
        manager=device_manager,
        logger=logger,
        poll_interval_sec=settings.adb_poll_interval_sec,
    )
    return AppContainer(
        settings=settings,
        logger=logger,
        ws_manager=ws_manager,
        media_client=media_client,
        media_scheduler=media_scheduler,
        device_controller=controller,
        device_manager=device_manager,
        adb_watcher=adb_watcher,
    )



def _include_routers(app: FastAPI, container: AppContainer) -> None:
    base = Path(__file__).resolve().parent / "api"

    device_router_mod = _load_module(base / "device.router.py", "device_router")
    control_router_mod = _load_module(base / "control.router.py", "control_router")
    stream_router_mod = _load_module(base / "stream.router.py", "stream_router")
    health_router_mod = _load_module(base / "health.router.py", "health_router")

    app.include_router(device_router_mod.build_router(container.device_manager))
    app.include_router(control_router_mod.build_router(container.device_manager))
    app.include_router(
        stream_router_mod.build_router(container.device_manager, container.media_client)
    )
    app.include_router(health_router_mod.build_router())


container = _build_container()
app = FastAPI(title="Phone Farm Orchestrator")
_include_routers(app, container)


@app.websocket("/ws/devices")
async def devices_ws(websocket: WebSocket) -> None:
    await container.ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await container.ws_manager.disconnect(websocket)


@app.websocket("/ws/logs")
async def logs_ws(websocket: WebSocket) -> None:
    await container.ws_manager.connect_logs(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            await container.ws_manager.broadcast_log(message)
    except WebSocketDisconnect:
        await container.ws_manager.disconnect_logs(websocket)


@app.on_event("startup")
async def on_startup() -> None:
    await container.adb_watcher.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await container.adb_watcher.stop()
    await container.media_client.close()
