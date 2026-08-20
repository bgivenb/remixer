from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .files import AUDIO_EXTENSIONS, data_root, read_manifest, tracks_root, write_manifest


DEFAULT_LIMIT_MB = 5 * 1024
MINIMUM_LIMIT_MB = 500
TUTORIAL_ID = "JR2zel8dJts"


def _settings_path() -> Path:
    return data_root() / "settings.json"


def _read_limit_mb() -> int:
    try:
        payload = json.loads(_settings_path().read_text(encoding="utf-8"))
        return max(MINIMUM_LIMIT_MB, int(payload.get("storage_limit_mb", DEFAULT_LIMIT_MB)))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return DEFAULT_LIMIT_MB


def _write_limit_mb(limit_mb: int) -> None:
    target = _settings_path()
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps({"storage_limit_mb": limit_mb}, indent=2), encoding="utf-8")
    temporary.replace(target)


def _directory_size(root: Path) -> int:
    total = 0
    seen: set[tuple[int, int]] = set()
    if not root.exists():
        return 0
    for file in root.rglob("*"):
        if not file.is_file():
            continue
        try:
            stat = file.stat()
        except OSError:
            continue
        identity = (stat.st_dev, stat.st_ino)
        if identity in seen:
            continue
        seen.add(identity)
        total += stat.st_size
    return total


def _projects() -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    for manifest_file in tracks_root().glob("*/track.json"):
        try:
            manifest = read_manifest(manifest_file)
            track_dir = manifest_file.parent
            projects.append({
                "id": str(manifest.get("id") or track_dir.name),
                "title": str(manifest.get("title") or track_dir.name),
                "track_dir": str(track_dir),
                "updated_at": str(manifest.get("updated_at") or ""),
                "size_bytes": _directory_size(track_dir),
                "offloaded": bool(manifest.get("offloaded")),
                "tutorial": manifest.get("id") == TUTORIAL_ID or bool(manifest.get("tutorial")),
            })
        except (OSError, ValueError, json.JSONDecodeError):
            continue
    return sorted(projects, key=lambda project: project["updated_at"], reverse=True)


def storage_status() -> dict[str, Any]:
    projects = _projects()
    return {
        "limit_mb": _read_limit_mb(),
        "minimum_limit_mb": MINIMUM_LIMIT_MB,
        "used_bytes": sum(project["size_bytes"] for project in projects),
        "projects": projects,
    }


def _offload_project(track_dir: Path) -> int:
    before = _directory_size(track_dir)
    manifest = read_manifest(track_dir)
    for file in list(track_dir.rglob("*")):
        if file.is_file() and file.name != "track.json" and file.suffix.lower() in AUDIO_EXTENSIONS:
            file.unlink()
    for directory in sorted((item for item in track_dir.rglob("*") if item.is_dir()), reverse=True):
        try:
            directory.rmdir()
        except OSError:
            pass
    manifest["stem_sets"] = {}
    manifest["offloaded"] = True
    write_manifest(track_dir, manifest)
    return max(0, before - _directory_size(track_dir))


def cleanup_storage(report, protected_track_dir: str | None = None, force: bool = False) -> dict[str, Any]:
    status = storage_status()
    limit_bytes = status["limit_mb"] * 1024 * 1024
    if not force and status["used_bytes"] <= limit_bytes:
        return {**status, "cleaned_bytes": 0, "cleaned_projects": []}
    protected = Path(protected_track_dir).resolve() if protected_track_dir else None
    cleaned_bytes = 0
    cleaned_projects: list[str] = []
    for project in sorted(status["projects"], key=lambda item: item["updated_at"]):
        track_dir = Path(project["track_dir"])
        if project["tutorial"] or project["offloaded"] or (protected and track_dir.resolve() == protected):
            continue
        report("storage", 0.2, f"Offloading {project['title']}")
        cleaned_bytes += _offload_project(track_dir)
        cleaned_projects.append(project["title"])
        if force or storage_status()["used_bytes"] <= limit_bytes:
            break
    updated = storage_status()
    report("storage", 1.0, "Storage cleanup complete")
    return {**updated, "cleaned_bytes": cleaned_bytes, "cleaned_projects": cleaned_projects}


def set_storage_limit(limit_mb: int, report, protected_track_dir: str | None = None) -> dict[str, Any]:
    if limit_mb < MINIMUM_LIMIT_MB:
        raise ValueError(f"Storage limit must be at least {MINIMUM_LIMIT_MB} MB.")
    _write_limit_mb(limit_mb)
    return cleanup_storage(report, protected_track_dir)


def offload_project(track_dir_value: str) -> dict[str, Any]:
    root = tracks_root().resolve()
    track_dir = Path(track_dir_value).resolve()
    if track_dir.parent != root or not (track_dir / "track.json").is_file():
        raise ValueError("Project is outside the Remixer track library.")
    manifest = read_manifest(track_dir)
    if manifest.get("id") == TUTORIAL_ID or manifest.get("tutorial"):
        raise ValueError("The Down So Bad tutorial project is protected.")
    freed = _offload_project(track_dir)
    return {**storage_status(), "cleaned_bytes": freed, "cleaned_projects": [str(manifest.get("title") or track_dir.name)]}
