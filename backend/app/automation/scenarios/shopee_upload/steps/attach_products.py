from __future__ import annotations

from ..actions.wait import wait_seconds
from ..constants import STEP_ATTACH_PRODUCTS, TIMEOUT
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    total = len(payload.products)

    if auto_log_context is not None:
        await auto_log_context.info(
            event="attach_products_started",
            message=f"Bat dau gan {total} san pham",
            step_key=STEP_ATTACH_PRODUCTS,
            meta={"totalProducts": total},
        )

    for index, product_id in enumerate(payload.products, start=1):
        await attach_one_product(
            payload=payload,
            product_id=product_id,
            index=index,
            total=total,
            auto_log_context=auto_log_context,
        )


async def attach_one_product(
    *,
    payload: ShopeeUploadPayload,
    product_id: str,
    index: int,
    total: int,
    auto_log_context=None,
) -> None:
    _ = payload
    if auto_log_context is not None:
        await auto_log_context.info(
            event="product_attach_started",
            message=f"Dang gan san pham {index}/{total}: {product_id}",
            step_key=STEP_ATTACH_PRODUCTS,
            meta={
                "productId": product_id,
                "productIndex": index,
                "totalProducts": total,
            },
        )

    await wait_seconds(TIMEOUT[STEP_ATTACH_PRODUCTS]["per_product_wait_sec"])

    if auto_log_context is not None:
        await auto_log_context.success(
            event="product_attach_succeeded",
            message=f"Da gan san pham {index}/{total}: {product_id}",
            step_key=STEP_ATTACH_PRODUCTS,
            meta={
                "productId": product_id,
                "productIndex": index,
                "totalProducts": total,
            },
        )
