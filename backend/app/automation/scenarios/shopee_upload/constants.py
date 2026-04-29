from __future__ import annotations

from typing import Any

SHOPEE_UPLOAD_SCENARIO_NAME = "upload_shopee_video"

STEP_PREPARE_VIDEO = "prepare_video"
STEP_OPEN_UPLOAD_FLOW = "open_upload_flow"
STEP_SELECT_VIDEO = "select_video"
STEP_INPUT_HASHTAG = "input_hashtag"
STEP_EDIT_VIDEO_SETTINGS = "edit_video_settings"
STEP_ATTACH_PRODUCTS = "attach_products"
STEP_SUBMIT_VIDEO = "submit_video"
STEP_WAIT_PUBLISH_RESULT = "wait_publish_result"
STEP_CLEANUP_DEVICE = "cleanup_device"

DEVICE_GALLERY_VIDEO_DIR = "/sdcard/DCIM/Camera"
DEVICE_AUTO_UPLOAD_PREFIX = "auto_upload"

MEDIA_SCAN_WAIT_SECONDS = 2.0
MEDIA_SCAN_RETRY_COUNT = 2
MEDIA_SCAN_RETRY_DELAY_SECONDS = 1.0

DEVICE_FILE_VERIFY_RETRY_COUNT = 3
DEVICE_FILE_VERIFY_RETRY_DELAY_SECONDS = 0.5

SHOPEE_UPLOAD_STEPS: tuple[dict[str, Any], ...] = (
    {
        "index": 1,
        "key": STEP_PREPARE_VIDEO,
        "name": "Đẩy video vào thiết bị",
        "type": "adb",
    },
    {
        "index": 2,
        "key": STEP_OPEN_UPLOAD_FLOW,
        "name": "Mở màn đăng video",
        "type": "u2",
    },
    {
        "index": 3,
        "key": STEP_SELECT_VIDEO,
        "name": "Chọn video từ thư viện",
        "type": "u2",
    },
    {
        "index": 4,
        "key": STEP_INPUT_HASHTAG,
        "name": "Nhập hashtag",
        "type": "input",
    },
    {
        "index": 5,
        "key": STEP_EDIT_VIDEO_SETTINGS,
        "name": "Chỉnh sửa video và thêm nhạc",
        "type": "u2",
    },
    {
        "index": 6,
        "key": STEP_ATTACH_PRODUCTS,
        "name": "Gắn sản phẩm",
        "type": "u2",
    },
    {
        "index": 7,
        "key": STEP_SUBMIT_VIDEO,
        "name": "Đăng video",
        "type": "u2",
    },
    {
        "index": 8,
        "key": STEP_WAIT_PUBLISH_RESULT,
        "name": "Chờ đăng video hoàn tất",
        "type": "wait",
    },
    {
        "index": 9,
        "key": STEP_CLEANUP_DEVICE,
        "name": "Dọn dẹp thiết bị",
        "type": "adb",
        "always_run": True,
    },
)


def get_step_by_key(step_key: str) -> dict[str, Any]:
    for step in SHOPEE_UPLOAD_STEPS:
        if str(step.get("key")) == step_key:
            return dict(step)
    raise KeyError(f"Unknown step key: {step_key}")


def get_main_steps() -> list[dict[str, Any]]:
    return [dict(step) for step in SHOPEE_UPLOAD_STEPS if not bool(step.get("always_run"))]


def get_cleanup_step() -> dict[str, Any]:
    for step in SHOPEE_UPLOAD_STEPS:
        if bool(step.get("always_run")):
            return dict(step)
    raise KeyError("Cleanup step is not configured")
