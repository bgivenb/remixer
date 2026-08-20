from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .files import (
    AUDIO_EXTENSIONS,
    convert_to_working_wav,
    ffprobe,
    read_manifest,
    safe_name,
    short_file_id,
    tracks_root,
    utc_now,
    write_manifest,
)


def import_local(file_value: str, report) -> dict[str, Any]:
    source = Path(file_value).expanduser().resolve()
    if not source.exists() or not source.is_file():
        raise FileNotFoundError(f"Audio file not found: {source}")
    if source.suffix.lower() not in AUDIO_EXTENSIONS:
        raise ValueError(f"Unsupported audio format: {source.suffix or 'unknown'}")

    report("import", 0.05, "Inspecting audio file")
    track_id = short_file_id(source)
    title = safe_name(source.stem)
    track_dir = tracks_root() / f"{safe_name(title, limit=64)}-{track_id}"
    track_dir.mkdir(parents=True, exist_ok=True)
    working = track_dir / "working.wav"

    if not working.exists():
        report("import", 0.2, "Creating lossless working audio")
        convert_to_working_wav(source, working)

    metadata = ffprobe(working)
    now = utc_now()
    existing = read_manifest(track_dir) if (track_dir / "track.json").exists() else {}
    payload = {
        **existing,
        "id": track_id,
        "title": title,
        "source_kind": "local",
        "source_url": None,
        "source_path": str(source),
        "working_path": str(working),
        "track_dir": str(track_dir),
        "thumbnail_path": None,
        "duration": metadata["duration"],
        "sample_rate": metadata["sample_rate"],
        "channels": metadata["channels"],
        "created_at": existing.get("created_at", now),
        "updated_at": now,
        "analysis": existing.get("analysis"),
        "stem_sets": existing.get("stem_sets", {}),
    }
    write_manifest(track_dir, payload)
    report("import", 1.0, "Track ready")
    return payload


def download_url(url: str, report) -> dict[str, Any]:
    if not url or not url.lower().startswith(("https://", "http://")):
        raise ValueError("Enter a valid http or https URL.")

    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError

    report("download", 0.02, "Reading video information")
    metadata_options = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True}
    try:
        with YoutubeDL(metadata_options) as ydl:
            info = ydl.extract_info(url, download=False)
    except DownloadError as exc:
        raise RuntimeError(str(exc)) from exc

    if info.get("_type") == "playlist":
        raise ValueError("Playlists are not supported in this version. Paste one video URL.")
    video_id = safe_name(str(info.get("id") or "video"), limit=32)
    title = safe_name(str(info.get("title") or video_id))
    track_id = video_id
    track_dir = tracks_root() / f"{safe_name(title, limit=64)}-{track_id}"
    track_dir.mkdir(parents=True, exist_ok=True)

    source_candidates = [path for path in track_dir.glob("source.*") if path.suffix.lower() in AUDIO_EXTENSIONS]
    source = source_candidates[0] if source_candidates else None

    def hook(status: dict[str, Any]) -> None:
        if status.get("status") == "downloading":
            total = status.get("total_bytes") or status.get("total_bytes_estimate") or 0
            downloaded = status.get("downloaded_bytes") or 0
            fraction = downloaded / total if total else 0.15
            report("download", 0.08 + 0.62 * min(1.0, fraction), "Downloading best available audio")
        elif status.get("status") == "finished":
            report("download", 0.72, "Download complete")

    if source is None:
        options = {
            "format": "bestaudio/best",
            "outtmpl": str(track_dir / "source.%(ext)s"),
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "progress_hooks": [hook],
            "writethumbnail": True,
            "overwrites": False,
        }
        try:
            with YoutubeDL(options) as ydl:
                downloaded_info = ydl.extract_info(url, download=True)
                prepared = Path(ydl.prepare_filename(downloaded_info))
        except DownloadError as exc:
            raise RuntimeError(str(exc)) from exc
        source_candidates = [path for path in track_dir.glob("source.*") if path.suffix.lower() in AUDIO_EXTENSIONS]
        source = prepared if prepared.exists() else (source_candidates[0] if source_candidates else None)

    if source is None or not source.exists():
        raise RuntimeError("The audio download completed but no audio file was produced.")

    working = track_dir / "working.wav"
    if not working.exists():
        report("convert", 0.76, "Decoding to lossless working audio")
        convert_to_working_wav(source, working)

    thumbnail = next(
        (path for path in track_dir.glob("source.*") if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}),
        None,
    )
    audio = ffprobe(working)
    now = utc_now()
    existing = read_manifest(track_dir) if (track_dir / "track.json").exists() else {}
    payload = {
        **existing,
        "id": track_id,
        "title": title,
        "artist": info.get("artist") or info.get("uploader") or info.get("channel"),
        "source_kind": "url",
        "source_url": url,
        "source_path": str(source),
        "working_path": str(working),
        "track_dir": str(track_dir),
        "thumbnail_path": str(thumbnail) if thumbnail else None,
        "duration": audio["duration"],
        "sample_rate": audio["sample_rate"],
        "channels": audio["channels"],
        "created_at": existing.get("created_at", now),
        "updated_at": now,
        "analysis": existing.get("analysis"),
        "stem_sets": existing.get("stem_sets", {}),
    }
    write_manifest(track_dir, payload)
    report("download", 1.0, "Track ready")
    return payload


def list_tracks() -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    for manifest in tracks_root().glob("*/track.json"):
        try:
            tracks.append(json.loads(manifest.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue
    return sorted(tracks, key=lambda item: item.get("updated_at", ""), reverse=True)

