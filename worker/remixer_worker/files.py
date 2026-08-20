from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


AUDIO_EXTENSIONS = {".wav", ".flac", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".aiff", ".aif", ".webm"}


def data_root() -> Path:
    configured = os.environ.get("REMIXER_DATA_DIR")
    root = Path(configured) if configured else Path.home() / "AppData" / "Local" / "Remixer" / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


def tracks_root() -> Path:
    root = data_root() / "tracks"
    root.mkdir(parents=True, exist_ok=True)
    return root


def models_root() -> Path:
    configured = os.environ.get("REMIXER_MODELS_DIR")
    root = Path(configured) if configured else data_root().parent / "models"
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_name(value: str, fallback: str = "track", limit: int = 96) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = re.sub(r"[<>:\"/\\|?*\x00-\x1f]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" .")
    return (normalized or fallback)[:limit].rstrip(" .")


def short_file_id(file: Path) -> str:
    stat = file.stat()
    digest = hashlib.sha256()
    digest.update(str(file.resolve()).encode("utf-8", "surrogatepass"))
    digest.update(str(stat.st_size).encode())
    digest.update(str(stat.st_mtime_ns).encode())
    with file.open("rb") as handle:
        digest.update(handle.read(1024 * 1024))
    return digest.hexdigest()[:12]


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def run_checked(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            check=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required executable was not found: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(details or f"Command failed: {command[0]}") from exc


def ffprobe(file: Path) -> dict[str, Any]:
    result = run_checked(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=index,codec_type,sample_rate,channels",
            "-of",
            "json",
            str(file),
        ]
    )
    payload = json.loads(result.stdout)
    audio = next((stream for stream in payload.get("streams", []) if stream.get("codec_type") == "audio"), {})
    return {
        "duration": float(payload.get("format", {}).get("duration") or 0.0),
        "sample_rate": int(audio.get("sample_rate") or 0),
        "channels": int(audio.get("channels") or 0),
    }


def convert_to_working_wav(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".partial.wav")
    if temporary.exists():
        temporary.unlink()
    run_checked(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vn",
            "-map_metadata",
            "-1",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-c:a",
            "pcm_f32le",
            str(temporary),
        ]
    )
    temporary.replace(destination)


def manifest_path(track_dir: Path) -> Path:
    return track_dir / "track.json"


def read_manifest(track_dir_or_file: str | Path) -> dict[str, Any]:
    path = Path(track_dir_or_file)
    if path.is_dir():
        path = manifest_path(path)
    if not path.exists():
        raise FileNotFoundError(f"Track manifest not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_manifest(track_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
    target = manifest_path(track_dir)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(target)
    return payload


def update_manifest(track_dir: Path, **changes: Any) -> dict[str, Any]:
    payload = read_manifest(track_dir)
    payload.update(changes)
    payload["updated_at"] = utc_now()
    return write_manifest(track_dir, payload)


def copy_or_link(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)
