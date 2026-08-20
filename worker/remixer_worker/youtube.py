from __future__ import annotations

from typing import Any


def search_youtube(query: str, limit: int = 8) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        raise ValueError("Enter something to search for on YouTube.")
    limit = max(1, min(int(limit), 12))

    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError

    options = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
        "noplaylist": True,
    }
    try:
        with YoutubeDL(options) as ydl:
            payload = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
    except DownloadError as exc:
        raise RuntimeError(str(exc)) from exc

    results = []
    for entry in payload.get("entries") or []:
        video_id = str(entry.get("id") or "").strip()
        if not video_id:
            continue
        thumbnails = entry.get("thumbnails") or []
        thumbnail = entry.get("thumbnail") or (thumbnails[-1].get("url") if thumbnails else None)
        results.append(
            {
                "id": video_id,
                "title": str(entry.get("title") or "Untitled video"),
                "channel": entry.get("channel") or entry.get("uploader") or entry.get("channel_id"),
                "duration": float(entry["duration"]) if entry.get("duration") is not None else None,
                "thumbnail": thumbnail or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    return results
