from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path


async def run_adb_command(
    device_id: str,
    args: list[str],
    *,
    timeout_sec: float = 30.0,
) -> str:
    cmd = ["adb", "-s", device_id, *args]

    def _run() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )

    result = await asyncio.to_thread(_run)

    if result.returncode != 0:
        raise RuntimeError(
            "ADB command failed: "
            f"{' '.join(cmd)}\n"
            f"stdout={result.stdout}\n"
            f"stderr={result.stderr}"
        )

    return result.stdout.strip()


async def ensure_device_dir(
    *,
    device_id: str,
    device_dir: str,
    auto_log_context=None,
) -> None:
    await run_adb_command(device_id, ["shell", "mkdir", "-p", device_dir])
    if auto_log_context is not None:
        await auto_log_context.info(
            event="ensure_device_dir",
            message=f"Đã đảm bảo thư mục thiết bị tồn tại: {device_dir}",
        )


async def push_video_to_device(
    *,
    device_id: str,
    local_video_path: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    device_dir = str(Path(device_video_path).parent)
    await ensure_device_dir(
        device_id=device_id,
        device_dir=device_dir,
        auto_log_context=auto_log_context,
    )

    local_size = None
    try:
        local_size = Path(local_video_path).stat().st_size
    except OSError:
        local_size = None

    await run_adb_command(
        device_id,
        ["push", local_video_path, device_video_path],
        timeout_sec=300.0,
    )
    await run_adb_command(
        device_id,
        ["shell", "sync"],
        timeout_sec=60.0,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_push_command_succeeded",
            message="Đã đẩy video vào thiết bị (adb push thành công)",
            meta={"deviceVideoPath": device_video_path, "localSize": local_size},
        )


async def get_device_file_size(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> int | None:
    try:
        output = await run_adb_command(
            device_id,
            [
                "shell",
                "sh",
                "-c",
                "if [ -f \"$1\" ]; then ls -ln \"$1\" | awk '{print $5}'; else echo -1; fi",
                "sh",
                device_video_path,
            ],
        )
    except RuntimeError as exc:
        if auto_log_context is not None:
            await auto_log_context.warning(
                event="prepare_video_verify_command_failed",
                message=f"Lệnh kiểm tra file thất bại: {exc}",
                meta={"deviceVideoPath": device_video_path},
            )
        return None

    raw = output.strip()
    try:
        size = int(raw)
    except (TypeError, ValueError):
        if auto_log_context is not None:
            await auto_log_context.warning(
                event="prepare_video_verify_parse_failed",
                message=f"Khong parse duoc file size tren thiet bi: {raw}",
                meta={"deviceVideoPath": device_video_path},
            )
        return None

    if size < 0:
        return None

    _ = auto_log_context
    return size


async def wait_for_device_file_exists(
    *,
    device_id: str,
    device_video_path: str,
    retry_count: int,
    retry_delay_sec: float,
    expected_size: int | None = None,
    auto_log_context=None,
) -> None:
    _ = (retry_count, retry_delay_sec, expected_size, auto_log_context)
    await run_adb_command(
        device_id,
        ["shell", "ls", "-l", device_video_path],
    )


async def trigger_media_scan(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    await run_adb_command(
        device_id,
        [
            "shell",
            "am",
            "broadcast",
            "-a",
            "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
            "-d",
            f"file://{device_video_path}",
        ],
    )
    _ = auto_log_context


async def trigger_media_scan_with_retry(
    *,
    device_id: str,
    device_video_path: str,
    retry_count: int,
    retry_delay_sec: float,
    auto_log_context=None,
) -> None:
    last_error: Exception | None = None
    for attempt in range(1, retry_count + 1):
        try:
            await trigger_media_scan(
                device_id=device_id,
                device_video_path=device_video_path,
                auto_log_context=auto_log_context,
            )
            return
        except Exception as exc:
            last_error = exc
            if auto_log_context is not None:
                await auto_log_context.warning(
                    event="prepare_video_media_scan_retry",
                    message=f"Media scan thất bại, thử lại lần {attempt}/{retry_count}",
                    meta={"error": str(exc), "deviceVideoPath": device_video_path},
                )
            await asyncio.sleep(retry_delay_sec)

    raise RuntimeError(f"Media scan failed after retries: {last_error}")


async def delete_device_file(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    await run_adb_command(device_id, ["shell", "rm", "-f", device_video_path])
    _ = auto_log_context
