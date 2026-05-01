from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path
from typing import Any


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


def _truncate(text: str, limit: int = 600) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...(truncated {len(text) - limit} chars)"


async def run_adb_command_raw(
    device_id: str,
    args: list[str],
    *,
    timeout_sec: float = 30.0,
) -> tuple[int, str, str]:
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
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    return result.returncode, stdout, stderr


async def _log_adb_result(
    *,
    auto_log_context: Any,
    event: str,
    message: str,
    device_id: str,
    device_video_path: str,
    command_label: str,
    command_args: list[str],
    return_code: int,
    stdout: str,
    stderr: str,
    level: str = "info",
) -> None:
    if auto_log_context is None:
        return
    meta = {
        "deviceId": device_id,
        "deviceVideoPath": device_video_path,
        "commandLabel": command_label,
        "commandArgs": command_args,
        "returnCode": return_code,
        "stdout": _truncate(stdout),
        "stderr": _truncate(stderr),
    }
    logger = getattr(auto_log_context, level, auto_log_context.info)
    await logger(event=event, message=message, meta=meta)


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


async def verify_device_file_deleted(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> bool:
    command_args = ["shell", "ls", "-l", device_video_path]
    return_code, stdout, stderr = await run_adb_command_raw(
        device_id,
        command_args,
        timeout_sec=15.0,
    )
    await _log_adb_result(
        auto_log_context=auto_log_context,
        event="cleanup_device_verify_deleted_command_finished",
        message="Da chay lenh verify xoa file tren thiet bi",
        device_id=device_id,
        device_video_path=device_video_path,
        command_label="verify_deleted_ls",
        command_args=command_args,
        return_code=return_code,
        stdout=stdout,
        stderr=stderr,
        level="info" if return_code != 0 else "warning",
    )
    return return_code != 0


async def refresh_media_store_after_delete(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    # A) Ask media scanner to refresh the deleted path.
    scan_args = [
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        f"file://{device_video_path}",
    ]
    if auto_log_context is not None:
        await auto_log_context.info(
            event="cleanup_device_media_scan_delete_started",
            message="Bat dau media scan sau khi xoa file",
            meta={"deviceId": device_id, "deviceVideoPath": device_video_path},
        )
    scan_rc, scan_out, scan_err = await run_adb_command_raw(
        device_id,
        scan_args,
        timeout_sec=20.0,
    )
    await _log_adb_result(
        auto_log_context=auto_log_context,
        event="cleanup_device_media_scan_delete_finished",
        message="Da chay media scan sau khi xoa file",
        device_id=device_id,
        device_video_path=device_video_path,
        command_label="media_scan_after_delete",
        command_args=scan_args,
        return_code=scan_rc,
        stdout=scan_out,
        stderr=scan_err,
        level="success" if scan_rc == 0 else "warning",
    )
    if scan_rc == 0 and auto_log_context is not None:
        await auto_log_context.success(
            event="cleanup_device_media_scan_delete_succeeded",
            message="Media scan sau delete thanh cong",
            meta={"deviceVideoPath": device_video_path},
        )

    # B) Delete exact MediaStore record by _data path.
    where_clause = f"_data='{device_video_path}'"
    delete_args = [
        "shell",
        "content",
        "delete",
        "--uri",
        "content://media/external/video/media",
        "--where",
        where_clause,
    ]
    if auto_log_context is not None:
        await auto_log_context.info(
            event="cleanup_device_media_store_record_delete_started",
            message="Bat dau xoa record MediaStore theo _data",
            meta={"deviceId": device_id, "deviceVideoPath": device_video_path},
        )
    del_rc, del_out, del_err = await run_adb_command_raw(
        device_id,
        delete_args,
        timeout_sec=25.0,
    )
    await _log_adb_result(
        auto_log_context=auto_log_context,
        event="cleanup_device_media_store_record_delete_finished",
        message="Da chay lenh xoa record MediaStore",
        device_id=device_id,
        device_video_path=device_video_path,
        command_label="media_store_delete_record",
        command_args=delete_args,
        return_code=del_rc,
        stdout=del_out,
        stderr=del_err,
        level="success" if del_rc == 0 else "warning",
    )
    if del_rc == 0:
        if auto_log_context is not None:
            await auto_log_context.success(
                event="cleanup_device_media_store_record_delete_succeeded",
                message="Xoa record MediaStore thanh cong",
                meta={"deviceVideoPath": device_video_path},
            )
    else:
        if auto_log_context is not None:
            await auto_log_context.warning(
                event="cleanup_device_media_store_record_delete_failed",
                message="Xoa record MediaStore that bai",
                meta={
                    "deviceVideoPath": device_video_path,
                    "returnCode": del_rc,
                    "stdout": _truncate(del_out),
                    "stderr": _truncate(del_err),
                },
            )
