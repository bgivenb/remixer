from __future__ import annotations

from pathlib import Path

import soundfile as sf

from remixer_worker.clips import render_clips
from remixer_worker.files import safe_name
from remixer_worker.tracks import import_local, list_tracks


def silent_report(_stage: str, _progress: float, _message: str) -> None:
    pass


def test_safe_name_removes_windows_metacharacters() -> None:
    assert safe_name('A <bad>: "name" / test?') == "A bad name test"


def test_import_and_render_exact_selection(synthetic_track: tuple[Path, Path]) -> None:
    source, _data = synthetic_track
    track = import_local(str(source), silent_report)
    assert Path(track["working_path"]).exists()
    assert track["duration"] == 8.0
    assert list_tracks()[0]["id"] == track["id"]

    rendered = render_clips(
        track["track_dir"],
        {"mix": track["working_path"]},
        1.25,
        3.75,
        120,
        "C Major",
        silent_report,
    )
    output = Path(rendered["paths"]["mix"])
    assert output.exists()
    info = sf.info(output)
    assert info.subtype == "FLOAT"
    assert info.frames == round(2.5 * info.samplerate)

