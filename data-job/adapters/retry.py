from __future__ import annotations

import time
from typing import Callable, TypeVar


T = TypeVar("T")


def retry_call(operation: Callable[[], T], attempts: int = 3, sleep_seconds: float = 0.2) -> T:
    last_error: Exception | None = None

    for attempt in range(attempts):
        try:
            return operation()
        except Exception as error:
            last_error = error
            if attempt < attempts - 1 and sleep_seconds > 0:
                time.sleep(sleep_seconds * (attempt + 1))

    if last_error:
        raise last_error
    raise RuntimeError("retry operation failed")
