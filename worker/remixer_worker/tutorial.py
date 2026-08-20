from __future__ import annotations

import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from .files import convert_to_working_wav, read_manifest, tracks_root, utc_now, write_manifest


TUTORIAL_ID = "JR2zel8dJts"
TUTORIAL_DIRECTORY = "Given Peace - Down So Bad (Official Music Video)-JR2zel8dJts"


def _complete(manifest: dict[str, Any]) -> bool:
    if manifest.get("id") != TUTORIAL_ID:
        return False
    return bool(manifest.get("working_path") and Path(manifest["working_path"]).is_file())


def _replace_track_dir(value: Any, track_dir: Path) -> Any:
    if isinstance(value, list):
        return [_replace_track_dir(item, track_dir) for item in value]
    if isinstance(value, dict):
        return {key: _replace_track_dir(item, track_dir) for key, item in value.items()}
    if isinstance(value, str):
        return value.replace("__TRACK_DIR__", str(track_dir))
    return value


def ensure_tutorial(report) -> dict[str, Any] | None:
    target = tracks_root() / TUTORIAL_DIRECTORY
    manifest_file = target / "track.json"
    if manifest_file.exists():
        existing = read_manifest(manifest_file)
        if _complete(existing):
            report("tutorial", 1.0, "Tutorial project ready")
            return existing

    archive_value = os.environ.get("REMIXER_TUTORIAL_ARCHIVE")
    if not archive_value or not Path(archive_value).is_file():
        return None
    archive = Path(archive_value)
    staging = Path(tempfile.mkdtemp(prefix="remixer-tutorial-", dir=tracks_root().parent))
    try:
        report("tutorial", 0.05, "Opening the bundled tutorial project")
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.infolist():
                resolved = (staging / member.filename).resolve()
                if staging.resolve() not in resolved.parents and resolved != staging.resolve():
                    raise ValueError("Tutorial archive contains an unsafe path.")
            bundle.extractall(staging)

        template_file = next(staging.rglob("track.template.json"), None)
        if not template_file:
            raise RuntimeError("The bundled tutorial manifest is missing.")
        bundled_root = template_file.parent
        target.mkdir(parents=True, exist_ok=True)
        report("tutorial", 0.18, "Preparing the Down So Bad mix")
        convert_to_working_wav(bundled_root / "working.wv", target / "working.wav")

        thumbnail = next(bundled_root.glob("thumbnail.*"), None)
        if thumbnail:
            shutil.copy2(thumbnail, target / thumbnail.name)
        template = json.loads(template_file.read_text(encoding="utf-8"))
        manifest = _replace_track_dir(template, target)
        manifest["updated_at"] = utc_now()
        write_manifest(target, manifest)
        if not _complete(manifest):
            raise RuntimeError("The tutorial project did not install completely.")
        report("tutorial", 1.0, "Down So Bad tutorial track ready")
        return manifest
    finally:
        shutil.rmtree(staging, ignore_errors=True)
