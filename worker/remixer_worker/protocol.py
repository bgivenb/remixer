from __future__ import annotations

import json
import sys
from collections.abc import Callable
from typing import Any


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, allow_nan=False) + "\n")
    sys.stdout.flush()


def progress_callback(request_id: str) -> Callable[[str, float, str], None]:
    def report(stage: str, value: float, message: str) -> None:
        emit(
            {
                "type": "progress",
                "request_id": request_id,
                "stage": stage,
                "progress": max(0.0, min(1.0, float(value))),
                "message": message,
            }
        )

    return report

