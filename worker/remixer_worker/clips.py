from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import soundfile as sf

from .files import safe_name


def render_clips(
    track_dir_value: str,
    files: dict[str, str],
    start: float,
    end: float,
    bpm: float | None,
    key: str | None,
    report,
) -> dict[str, Any]:
    track_dir = Path(track_dir_value).resolve()
    start = max(0.0, float(start))
    end = float(end)
    if end <= start:
        raise ValueError("The clip selection is empty.")
    token = hashlib.sha1(f"{start:.6f}:{end:.6f}".encode()).hexdigest()[:8]
    clip_dir = track_dir / "clips" / f"{start:.3f}-{end:.3f}-{token}"
    clip_dir.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, str] = {}

    for index, (stem, file_value) in enumerate(files.items()):
        source = Path(file_value).resolve()
        if not source.exists():
            raise FileNotFoundError(f"Stem not found: {source}")
        progress = index / max(1, len(files))
        report("clip", progress, f"Rendering {stem} selection")
        with sf.SoundFile(source) as input_file:
            start_frame = max(0, min(len(input_file), round(start * input_file.samplerate)))
            end_frame = max(start_frame, min(len(input_file), round(end * input_file.samplerate)))
            input_file.seek(start_frame)
            audio = input_file.read(end_frame - start_frame, dtype="float32", always_2d=True)
            parts = [safe_name(stem.title())]
            if bpm:
                parts.append(f"{round(float(bpm), 2):g} BPM")
            if key:
                parts.append(safe_name(key))
            destination = clip_dir / (" - ".join(parts) + ".wav")
            sf.write(destination, audio, input_file.samplerate, subtype="FLOAT")
            rendered[stem] = str(destination.resolve())

    report("clip", 1.0, f"Rendered {len(rendered)} clips")
    return {"paths": rendered, "directory": str(clip_dir), "start": start, "end": end}

