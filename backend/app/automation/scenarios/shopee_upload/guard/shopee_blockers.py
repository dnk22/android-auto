from __future__ import annotations

SHOPEE_BLOCKERS = {
    "PROMO_POPUP_BANNER": {
        "name": "Shopee promo popup banner",
        "anchor_resource_id": "com.shopee.vn:id/popup_banner_image",
        "short_resource_id": "popup_banner_image",
        "package_name": "com.shopee.vn",
        "class_name": "android.view.ViewGroup",
        "close_strategy": "relative_top_right",
        "relative_close_area": {
            "x_from_right_min": 75,
            "x_from_right_max": 20,
            "y_from_top_min": 15,
            "y_from_top_max": 70,
        },
    },
    "SHADOW_OVERLAY": {
        "name": "Shopee shadow overlay",
        "resource_id": "com.shopee.vn:id/shadow_view",
        "short_resource_id": "shadow_view",
    },
    "GENERIC_CLOSE_BUTTON": {
        "name": "Generic close button",
        "candidates": [
            {"resource_id_matches": ".*close.*"},
            {"resource_id_matches": ".*close_button.*"},
            {"resource_id_matches": ".*btn_close.*"},
            {"description_contains": "Đóng"},
            {"description_contains": "Close"},
            {"text": "Đóng"},
            {"text": "Close"},
            {"text": "×"},
            {"text": "X"},
        ],
    },
}
