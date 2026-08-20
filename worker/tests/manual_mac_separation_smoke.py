"""Run both production models on a short exact-length input for release validation."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from remixer_worker.separation import release_models, separate
from remixer_worker.tracks import import_local


def report(stage: str, progress: float, message: str) -> None:
    print(f"[{stage:10}] {progress:6.1%} {message}", flush=True)


def main() -> None:
    sample_rate = 44_100
    frame_count = sample_rate * 2
    time = np.arange(frame_count, dtype=np.float32) / sample_rate
    audio = np.column_stack(
        (
            0.1 * np.sin(2 * np.pi * 220 * time),
            0.1 * np.sin(2 * np.pi * 330 * time),
        )
    )

    with tempfile.TemporaryDirectory(prefix="remixer-separation-smoke-") as temporary:
        source = Path(temporary) / "Remixer smoke – 夜.wav"
        sf.write(source, audio, sample_rate, subtype="FLOAT")
        track = import_local(str(source), report)
        expected_frames = sf.info(track["working_path"]).frames
        results = {}
        for mode in ("full", "vocals"):
            stem_set = separate(track["track_dir"], mode, report)
            lengths = {stem: sf.info(file).frames for stem, file in stem_set["paths"].items()}
            if not lengths or any(length != expected_frames for length in lengths.values()):
                raise RuntimeError(f"{mode} output-length mismatch: expected {expected_frames}, got {lengths}")
            results[mode] = {
                "backend": stem_set.get("backend"),
                "device": stem_set["device"],
                "frames": lengths,
            }
            release_models()

        print(json.dumps({"expected_frames": expected_frames, "results": results}, indent=2))


if __name__ == "__main__":
    main()
