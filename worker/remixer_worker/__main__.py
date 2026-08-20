from __future__ import annotations

import json
import sys
import traceback
from typing import Any

from .protocol import emit, progress_callback


def dispatch(request: dict[str, Any], report) -> Any:
    command = request.get("command")
    if command == "health":
        from .health import health

        return health()
    if command == "import":
        from .tracks import import_local

        return import_local(str(request["path"]), report)
    if command == "download":
        from .tracks import download_url

        return download_url(str(request["url"]), report)
    if command == "list_tracks":
        from .tracks import list_tracks

        return list_tracks()
    if command == "waveform":
        from .waveform import waveform_peaks

        return waveform_peaks(str(request["path"]), int(request.get("points", 4800)))
    if command == "analyze":
        from .analysis import analyze_track

        return analyze_track(
            str(request["track_dir"]),
            float(request["start"]) if request.get("start") is not None else None,
            float(request["end"]) if request.get("end") is not None else None,
            report,
        )
    if command == "separate":
        from .separation import separate

        return separate(str(request["track_dir"]), str(request.get("mode", "full")), report)
    if command == "release_models":
        from .separation import release_models

        return release_models()
    if command == "render_clips":
        from .clips import render_clips

        return render_clips(
            str(request["track_dir"]),
            dict(request["files"]),
            float(request["start"]),
            float(request["end"]),
            float(request["bpm"]) if request.get("bpm") else None,
            str(request["key"]) if request.get("key") else None,
            report,
        )
    raise ValueError(f"Unknown command: {command}")


def main() -> None:
    emit({"type": "ready", "data": {"version": "0.1.1"}})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = "unknown"
        try:
            request = json.loads(line)
            request_id = str(request.get("request_id") or "unknown")
            result = dispatch(request, progress_callback(request_id))
            emit({"type": "result", "request_id": request_id, "ok": True, "data": result})
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            emit({"type": "error", "request_id": request_id, "ok": False, "error": str(exc)})


if __name__ == "__main__":
    main()
