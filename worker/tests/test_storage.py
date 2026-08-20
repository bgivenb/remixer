import json
from pathlib import Path

import pytest

from remixer_worker import storage


def _project(root: Path, name: str, *, tutorial: bool = False) -> Path:
    track_dir = root / "tracks" / name
    (track_dir / "stems" / "full").mkdir(parents=True)
    working = track_dir / "working.wav"
    stem = track_dir / "stems" / "full" / "vocals.wav"
    working.write_bytes(b"mix" * 1024)
    stem.write_bytes(b"stem" * 1024)
    manifest = {
        "id": storage.TUTORIAL_ID if tutorial else name,
        "title": name,
        "track_dir": str(track_dir),
        "source_kind": "url",
        "source_url": f"https://www.youtube.com/watch?v={name}",
        "source_path": str(track_dir / "source.webm"),
        "working_path": str(working),
        "updated_at": "2026-01-01T00:00:00Z",
        "analysis": {"bpm": 120, "chords": {"segments": [{"label": "Am", "start": 0, "end": 1}]}},
        "stem_sets": {"full": {"paths": {"vocals": str(stem)}}},
        "tutorial": tutorial,
    }
    (track_dir / "track.json").write_text(json.dumps(manifest), encoding="utf-8")
    return track_dir


def test_offload_retains_lightweight_history(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REMIXER_DATA_DIR", str(tmp_path))
    track_dir = _project(tmp_path, "ordinary")
    _project(tmp_path, "tutorial", tutorial=True)

    result = storage.cleanup_storage(lambda *_: None, force=True)
    manifest = json.loads((track_dir / "track.json").read_text(encoding="utf-8"))

    assert result["cleaned_bytes"] > 0
    assert manifest["offloaded"] is True
    assert manifest["analysis"]["chords"]["segments"][0]["label"] == "Am"
    assert manifest["source_url"].endswith("ordinary")
    assert manifest["stem_sets"] == {}
    assert not (track_dir / "working.wav").exists()
    tutorial = next(project for project in storage.storage_status()["projects"] if project["tutorial"])
    assert tutorial["offloaded"] is False


def test_storage_limit_has_500_mb_floor(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REMIXER_DATA_DIR", str(tmp_path))
    with pytest.raises(ValueError, match="at least 500 MB"):
        storage.set_storage_limit(499, lambda *_: None)
