import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

_events: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    window_start = now - window_seconds
    with _lock:
        bucket = _events[key]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
            )
        bucket.append(now)
