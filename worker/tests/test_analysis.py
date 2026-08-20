from __future__ import annotations

from pathlib import Path

from remixer_worker.analysis import analyze_track
from remixer_worker.tracks import import_local
from remixer_worker.waveform import waveform_peaks


def silent_report(_stage: str, _progress: float, _message: str) -> None:
    pass


def test_analysis_finds_tempo_key_and_chords(synthetic_track: tuple[Path, Path]) -> None:
    source, _data = synthetic_track
    track = import_local(str(source), silent_report)
    analysis = analyze_track(track["track_dir"], 0.0, 8.0, silent_report)

    assert 110 <= analysis["bpm"] <= 130
    assert analysis["bpm_candidates"][0] == analysis["bpm"]
    assert analysis["key"]["tonic"] == "C"
    assert analysis["key"]["mode"] == "major"
    assert analysis["chords"]["segments"]
    assert analysis["chords"]["progression"][0] == "C"


def test_waveform_peaks_are_compact_and_duration_accurate(synthetic_track: tuple[Path, Path]) -> None:
    source, _data = synthetic_track
    waveform = waveform_peaks(str(source), points=1200)

    assert abs(waveform["duration"] - 8.0) < 0.001
    assert 1000 <= waveform["points"] <= 2400
    assert len(waveform["peaks"]) == 1
