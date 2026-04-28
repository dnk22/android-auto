from __future__ import annotations

import importlib.util
import asyncio
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path
from types import ModuleType

from fastapi import APIRouter


_BASE_DIR = Path(__file__).resolve().parent
LogSink = Callable[[dict[str, object]], Awaitable[None]]


def _load_module(relative_path: str, module_name: str) -> ModuleType:
    file_path = _BASE_DIR / relative_path
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load automation module from: {file_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


_constants_mod = _load_module(
    "constants/automation.constants.py",
    "app.automation.constants.automation_constants",
)
_sheet_model_mod = _load_module("models/sheet.model.py", "app.automation.models.sheet_model")
_job_model_mod = _load_module("models/job.model.py", "app.automation.models.job_model")
_job_execution_model_mod = _load_module(
    "models/job_execution.model.py",
    "app.automation.models.job_execution_model",
)
_runtime_job_model_mod = _load_module(
    "models/runtime_job.model.py",
    "app.automation.models.runtime_job_model",
)
_schemas_mod = _load_module(
    "schemas/automation.schema.py",
    "app.automation.schemas.automation_schema",
)
_validator_mod = _load_module("utils/validator.py", "app.automation.utils.validator")
_shopee_bot_mod = _load_module(
    "services/shopee_bot.service.py",
    "app.automation.services.shopee_bot_service",
)
_sheet_service_mod = _load_module(
    "services/sheet.service.py",
    "app.automation.services.sheet_service",
)
_execution_service_mod = _load_module(
    "services/execution.service.py",
    "app.automation.services.execution_service",
)
_device_lock_service_mod = _load_module(
    "services/device_lock.service.py",
    "app.automation.services.device_lock_service",
)
_storage_service_mod = _load_module(
    "services/storage.service.py",
    "app.automation.services.storage_service",
)
_job_queue_mod = _load_module(
    "services/job_queue.service.py",
    "app.automation.services.job_queue_service",
)
_execution_dispatcher_mod = _load_module(
    "services/execution_dispatcher.service.py",
    "app.automation.services.execution_dispatcher_service",
)
_watcher_mod = _load_module("utils/file_watcher.py", "app.automation.utils.file_watcher")
_controller_mod = _load_module(
    "controllers/automation.controller.py",
    "app.automation.controllers.automation_controller",
)
_system_logger_mod = _load_module(
    "logging/system_logger.py",
    "app.automation.logging.system_logger",
)


class AutomationRuntime:
    def __init__(self) -> None:
        self._system_logger = _system_logger_mod.AutomationSystemLogger()
        self._settings = _constants_mod.load_automation_settings()

        self._sheet_service = _sheet_service_mod.SheetService(
            logger=self._system_logger,
            ready_debounce_sec=self._settings.ready_debounce_sec,
            storage_path=self._settings.storage_dir,
        )
        self._execution_service = _execution_service_mod.ExecutionService(
            db_path=self._settings.storage_dir / "automation.db",
            logger=self._system_logger,
        )
        self._device_lock_service = _device_lock_service_mod.DeviceLockService(
            db_path=self._settings.storage_dir / "automation.db",
        )
        self._storage_service = _storage_service_mod.StorageService(
            settings=self._settings,
            logger=self._system_logger,
        )
        self._shopee_bot = _shopee_bot_mod.ShopeeBot(
            logger=self._system_logger,
            timeout_sec=self._settings.u2_timeout_sec,
        )
        self._job_queue = _job_queue_mod.JobQueueService(
            sheet_service=self._sheet_service,
            storage_service=self._storage_service,
            shopee_bot=self._shopee_bot,
            execution_service=self._execution_service,
            device_lock_service=self._device_lock_service,
            logger=self._system_logger,
        )
        self._execution_dispatcher = _execution_dispatcher_mod.ExecutionDispatcherService(
            execution_service=self._execution_service,
            sheet_service=self._sheet_service,
            device_lock_service=self._device_lock_service,
            queue_service=self._job_queue,
            logger=self._system_logger,
            poll_interval_sec=self._settings.dispatcher_poll_interval_sec,
        )

        self._sheet_service.bind_dependencies(
            storage_service=self._storage_service,
            queue_service=self._job_queue,
            execution_service=self._execution_service,
        )
        self._storage_service.bind_sheet_service(self._sheet_service)

        self._watcher = _watcher_mod.StorageWatcher(
            storage_path=self._storage_service.storage_path,
            storage_service=self._storage_service,
            logger=self._system_logger,
            debounce_sec=self._settings.watcher_debounce_sec,
        )

        self._router: APIRouter = _controller_mod.build_router(
            self._sheet_service,
            self._storage_service,
            self._job_queue,
            self._watcher,
        )

    @property
    def router(self) -> APIRouter:
        return self._router

    def set_log_sink(self, sink) -> None:
        self._system_logger.set_sink(sink)

    async def startup(self) -> None:
        self._system_logger.set_loop(asyncio.get_running_loop())
        await self._sheet_service.startup()
        await self._storage_service.ensure_storage_dir()
        await self._storage_service.sync_sheet_from_storage()
        await self._job_queue.start()
        await self._execution_dispatcher.start()
        await self._watcher.start()
        watch_path_raw = await self._storage_service.get_video_folder_path()
        watch_path = Path(watch_path_raw) if watch_path_raw else None
        await self._watcher.update_watch_state(
            enabled=watch_path is not None,
            watch_path=watch_path,
        )

    async def shutdown(self) -> None:
        self._system_logger.set_loop(None)
        await self._watcher.stop()
        await self._execution_dispatcher.stop()
        await self._job_queue.stop()
        await self._sheet_service.cancel()


_runtime = AutomationRuntime()


def get_router() -> APIRouter:
    return _runtime.router


def set_log_sink(sink: LogSink) -> None:
    _runtime.set_log_sink(sink)


async def startup() -> None:
    await _runtime.startup()


async def shutdown() -> None:
    await _runtime.shutdown()
