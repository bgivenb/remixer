from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


def waveform_peaks(file_value: str, points: int = 4800) -> dict[str, Any]:
    """Return compact, pre-decoded peaks so the UI never decodes a huge WAV."""
    source = Path(file_value).expanduser().resolve()
    if not source.exists() or not source.is_file():
        raise FileNotFoundError(f"Audio file not found: {source}")

    point_count = max(600, min(int(points), 12_000))
    values: list[float] = []
    with sf.SoundFile(source) as audio:
        frames = int(audio.frames)
        if frames <= 0 or audio.samplerate <= 0:
            raise ValueError("The audio file is empty.")
        block_size = max(1, math.ceil(frames / point_count))
        for block in audio.blocks(blocksize=block_size, dtype="float32", always_2d=True):
            mono = np.mean(block, axis=1)
            values.extend((float(np.min(mono)), float(np.max(mono))))

        duration = frames / float(audio.samplerate)

    return {
        "peaks": [values],
        "duration": duration,
        "points": len(values),
    }
