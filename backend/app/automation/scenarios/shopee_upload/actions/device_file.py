from __future__ import annotations

import asyncio

async def push_video_to_device(
    *,
    device_id: str,
    local_video_path: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    process = await asyncio.create_subprocess_exec(
        "adb",
        "-s",
        device_id,
        "push",
        local_video_path,
        device_video_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        message = (stderr or stdout or b"").decode(errors="ignore").strip()
        raise RuntimeError(f"adb push failed: {message or 'unknown error'}")
    _ = auto_log_context


async def trigger_media_scan(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    process = await asyncio.create_subprocess_exec(
        "adb",
        "-s",
        device_id,
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        f"file://{device_video_path}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        message = (stderr or stdout or b"").decode(errors="ignore").strip()
        raise RuntimeError(f"media scan failed: {message or 'unknown error'}")
    _ = auto_log_context


async def delete_device_file(
    *,
    device_id: str,
    device_video_path: str,
    auto_log_context=None,
) -> None:
    process = await asyncio.create_subprocess_exec(
        "adb",
        "-s",
        device_id,
        "shell",
        "rm",
        "-f",
        device_video_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        message = (stderr or stdout or b"").decode(errors="ignore").strip()
        raise RuntimeError(f"delete device file failed: {message or 'unknown error'}")
    _ = auto_log_context
