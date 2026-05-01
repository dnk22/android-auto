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
        UiSelector(text_contains="Đăng video"),
        UiSelector(text_contains="Kênh Người sáng tạo"),
        UiSelector(text_contains="Người đang theo dõi"),
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
        UiSelector(text_contains="Tiếp theo"),
        UiSelector(resource_id="com.shopee.vn:id/tv_pick_next"),
        UiSelector(resource_id="com.shopee.vn:id/tv_compress"),
    ]
    
    # edit video settings selectors
    ADD_MUSIC_BUTTON = [
        UiSelector(resource_id="com.shopee.vn:id/ll_music"),
        UiSelector(resource_id="com.shopee.vn:id/tv_music"),
        UiSelector(text_contains="Thêm nhạc"),
    ]
    
    IMPROVE_VIDEO_BUTTON = [
        UiSelector(text_contains="Cải thiện"),
        UiSelector(class_name="android.widget.LinearLayout", index=3),
    ]
    
    SELECT_MUSIC_FIRST_ITEM = [
        UiSelector(resource_id="com.shopee.vn:id/cl_container"),
        UiSelector(class_name="android.view.ViewGroup", index=0),
    ]
    
    # input hashtag selectors
    HASHTAG_INPUT = [
        UiSelector(resource_id="com.shopee.vn.dfpluginshopee16:id/ll_caption"),
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
    # submit
    SUBMIT_BUTTON = [
        UiSelector(resource_id="com.shopee.vn.dfpluginshopee16:id/btn_post"),
        UiSelector(text_contains="Đăng"),
    ]
    
    UPLOAD_LOADING_SELECTORS = [
        UiSelector(text_contains="Đang tải"),
    ]
    
    OK_BUTTON = [
        UiSelector(text_contains="Đồng ý"),
    ]
