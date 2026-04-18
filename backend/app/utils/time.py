from __future__ import annotations

import time



def now_ts() -> float:
    return time.time()



def is_stale(last_frame_at: float | None, stale_after_sec: float) -> bool:
    if last_frame_at is None:
        return True
    return (now_ts() - last_frame_at) > stale_after_sec
