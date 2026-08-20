from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf


@pytest.fixture()
def synthetic_track(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    sample_rate = 44100
    duration = 8.0
    time = np.arange(round(sample_rate * duration), dtype=np.float32) / sample_rate
    chord_frequencies = [261.63, 329.63, 392.00]
    audio = sum(0.16 * np.sin(2 * np.pi * frequency * time) for frequency in chord_frequencies)
    click = np.zeros_like(time)
    for beat in np.arange(0, duration, 0.5):
        start = round(beat * sample_rate)
        length = min(round(0.025 * sample_rate), len(click) - start)
        envelope = np.linspace(1, 0, length, dtype=np.float32)
        click[start : start + length] = 0.7 * envelope
    stereo = np.stack([audio + click, audio + click], axis=1).astype(np.float32)
    source = tmp_path / "Synthetic C Major.wav"
    sf.write(source, stereo, sample_rate, subtype="FLOAT")
    data = tmp_path / "data"
    monkeypatch.setenv("REMIXER_DATA_DIR", str(data))
    return source, data

