"""Manual production-engine smoke test used during release verification."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from remixer_worker.analysis import analyze_track
from remixer_worker.clips import render_clips
from remixer_worker.separation import separate
from remixer_worker.tracks import import_local


def report(stage: str, progress: float, message: str) -> None:
    print(f"[{stage:10}] {progress:6.1%} {message}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    args = parser.parse_args()

    track = import_local(str(args.audio), report)
    analysis = analyze_track(track["track_dir"], 0.0, min(2.0, track["duration"]), report)
    stems = separate(track["track_dir"], "full", report)
    clips = render_clips(
        track["track_dir"],
        stems["paths"],
        0.25,
        min(1.75, track["duration"]),
        analysis["bpm"],
        analysis["key"]["label"],
        report,
    )
    print(
        json.dumps(
            {
                "track": track["title"],
                "analysis": {"bpm": analysis["bpm"], "key": analysis["key"]["label"]},
                "stems": stems["paths"],
                "clips": clips["paths"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
