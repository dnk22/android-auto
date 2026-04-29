from __future__ import annotations

from app.automation.device.u2.selectors import UiSelector


class ShopeeUiSelectors:
    VIDEO_TAB = [
        UiSelector(description_contains="tab_bar_button_video_and_live"),
    ]

    PROFILE_TAB = [
        UiSelector(description_contains="click me page icon"),
    ]
    
    PROFILE_UPLOAD_DASHBOARD_MARKERS = [
        UiSelector(text_contains="Kênh Người sáng tạo"),
        UiSelector(text_contains="Người đang theo dõi"),
        UiSelector(text_contains="Đăng video"),
    ]

    UPLOAD_VIDEO_BUTTON = [
        UiSelector(description_contains="click to post video"),
        UiSelector(text_contains="Đăng video"),
    ]
    
    BOX_SELECT_FROM_GALLERY = [
        UiSelector(resource_id="com.shopee.vn:id/fl_right_tool_item"),
        UiSelector(resource_id="com.shopee.vn:id/tv_gallery_entrance"),
    ]

    FIRST_VIDEO_IN_PICKER = [
        UiSelector(resource_id="com.shopee.vn:id/ll_check"),
        UiSelector(class_name="android.widget.LinearLayout", index=1),
    ]
    
    NEXT_BUTTON = [
        UiSelector(resource_id="com.shopee.vn:id/tv_pick_next"),
        UiSelector(text_contains="Tiếp theo"),
    ]

    HASHTAG_INPUT = [
        UiSelector(class_name="android.widget.EditText"),
    ]

    PRODUCT_BUTTON = [
        UiSelector(text_contains="Sản phẩm"),
        UiSelector(description_contains="Sản phẩm"),
    ]

    PRODUCT_SEARCH_INPUT = [
        UiSelector(class_name="android.widget.EditText"),
    ]

    PRODUCT_ADD_BUTTON = [
        UiSelector(text_contains="Thêm"),
        UiSelector(description_contains="Thêm"),
    ]

    SUBMIT_BUTTON = [
        UiSelector(text_contains="Đăng"),
        UiSelector(description_contains="Đăng"),
    ]
