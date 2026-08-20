from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import librosa
import numpy as np
from scipy.ndimage import median_filter

from .files import read_manifest, write_manifest, utc_now


PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], dtype=np.float64)
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17], dtype=np.float64)


def _finite(value: float, default: float = 0.0) -> float:
    return float(value) if math.isfinite(float(value)) else default


def _key_candidate(tonic: int, mode: str, confidence: float) -> dict[str, Any]:
    return {
        "label": f"{PITCHES[tonic]} {'Major' if mode == 'major' else 'Minor'}",
        "tonic": PITCHES[tonic],
        "mode": mode,
        "confidence": float(np.clip(confidence, 0.0, 1.0)),
        "camelot": _camelot(tonic, mode),
    }


def _estimate_key(chroma: np.ndarray) -> dict[str, Any]:
    clean = np.nan_to_num(chroma.astype(np.float64, copy=False), nan=0.0, posinf=0.0, neginf=0.0)
    frame_norms = np.linalg.norm(clean, axis=0)
    clean = clean[:, frame_norms > 1e-8]
    if clean.size == 0:
        return {"label": "Unknown", "tonic": None, "mode": None, "confidence": 0.0, "camelot": None}

    # Normalize every frame before aggregation so loud intros, drops, or isolated
    # bass notes cannot dominate the key estimate for the whole track.
    clean /= np.maximum(np.linalg.norm(clean, axis=0, keepdims=True), 1e-8)
    profile = 0.72 * np.mean(clean, axis=1) + 0.28 * np.median(clean, axis=1)
    score_matrix = np.zeros((12, 2), dtype=np.float64)
    for tonic in range(12):
        for mode_index, base in enumerate((MAJOR_PROFILE, MINOR_PROFILE)):
            candidate = np.roll(base, tonic)
            correlation = float(np.corrcoef(profile, candidate)[0, 1])
            score_matrix[tonic, mode_index] = _finite(correlation, -1.0)

    # Vote for the tonic over shorter musical passages. Mode is decided only
    # after the root is stable; this avoids returning the dominant as the key.
    tonic_votes = np.zeros(12, dtype=np.float64)
    window_frames = min(clean.shape[1], 256)
    if window_frames >= 24:
        for start in range(0, clean.shape[1] - window_frames + 1, window_frames):
            local_profile = np.mean(clean[:, start : start + window_frames], axis=1)
            local_roots = np.full(12, -1.0, dtype=np.float64)
            for tonic in range(12):
                local_roots[tonic] = max(
                    _finite(float(np.corrcoef(local_profile, np.roll(MAJOR_PROFILE, tonic))[0, 1]), -1.0),
                    _finite(float(np.corrcoef(local_profile, np.roll(MINOR_PROFILE, tonic))[0, 1]), -1.0),
                )
            order = np.argsort(local_roots)
            margin = max(0.01, float(local_roots[order[-1]] - local_roots[order[-2]]))
            tonic_votes[int(order[-1])] += margin
    if float(np.sum(tonic_votes)) > 0:
        tonic_votes /= np.sum(tonic_votes)

    root_scores = np.max(score_matrix, axis=1) + 0.12 * tonic_votes
    root_order = np.argsort(root_scores)
    tonic = int(root_order[-1])
    root_margin = float(root_scores[root_order[-1]] - root_scores[root_order[-2]])
    major_score = float(score_matrix[tonic, 0])
    minor_score = float(score_matrix[tonic, 1])
    mode_margin = abs(major_score - minor_score)
    mode_ambiguous = mode_margin < 0.10

    # Sparse electronic tracks often omit the third entirely. In that case a
    # hard major/minor claim is artificial; use a conservative major lean and
    # return the same-root minor candidate prominently for one-click correction.
    mode = "major" if major_score >= minor_score or mode_ambiguous else "minor"
    mode_index = 0 if mode == "major" else 1
    primary_score = float(score_matrix[tonic, mode_index])
    confidence = float(
        np.clip(0.18 + 1.8 * max(0.0, root_margin) + 1.6 * mode_margin + 0.18 * max(0.0, primary_score), 0.0, 1.0)
    )
    if mode_ambiguous:
        confidence = min(confidence, 0.55)

    primary = _key_candidate(tonic, mode, confidence)
    ranked: list[tuple[float, int, str]] = []
    for candidate_tonic in range(12):
        ranked.append((float(score_matrix[candidate_tonic, 0]), candidate_tonic, "major"))
        ranked.append((float(score_matrix[candidate_tonic, 1]), candidate_tonic, "minor"))
    ranked.sort(reverse=True)

    alternatives: list[dict[str, Any]] = []
    if mode_ambiguous:
        other_mode = "minor" if mode == "major" else "major"
        alternatives.append(_key_candidate(tonic, other_mode, confidence * 0.92))
    for score, candidate_tonic, candidate_mode in ranked:
        if candidate_tonic == tonic and candidate_mode == mode:
            continue
        if any(item["tonic"] == PITCHES[candidate_tonic] and item["mode"] == candidate_mode for item in alternatives):
            continue
        relative_confidence = float(np.clip(confidence - max(0.0, primary_score - score), 0.05, 0.95))
        alternatives.append(_key_candidate(candidate_tonic, candidate_mode, relative_confidence))
        if len(alternatives) == 3:
            break

    return {
        **primary,
        "mode_ambiguous": mode_ambiguous,
        "alternatives": alternatives,
    }


def _tempo_candidates(raw_tempo: float) -> tuple[float, list[float]]:
    if raw_tempo <= 0 or not math.isfinite(raw_tempo):
        return 0.0, []
    possibilities = [raw_tempo]
    if 50.0 <= raw_tempo / 2.0 <= 200.0:
        possibilities.append(raw_tempo / 2.0)
    if 50.0 <= raw_tempo * 2.0 <= 200.0:
        possibilities.append(raw_tempo * 2.0)
    if raw_tempo < 90.0 and raw_tempo * 2.0 <= 190.0:
        primary = raw_tempo * 2.0
    elif raw_tempo > 180.0 and raw_tempo / 2.0 >= 60.0:
        primary = raw_tempo / 2.0
    else:
        primary = raw_tempo
    ordered = [primary, *possibilities]
    unique: list[float] = []
    for value in ordered:
        rounded = round(float(value), 2)
        if all(abs(rounded - existing) > 0.02 for existing in unique):
            unique.append(rounded)
    return unique[0], unique


def _camelot(tonic: int, mode: str) -> str:
    major = {0: "8B", 1: "3B", 2: "10B", 3: "5B", 4: "12B", 5: "7B", 6: "2B", 7: "9B", 8: "4B", 9: "11B", 10: "6B", 11: "1B"}
    minor = {0: "5A", 1: "12A", 2: "7A", 3: "2A", 4: "9A", 5: "4A", 6: "11A", 7: "6A", 8: "1A", 9: "8A", 10: "3A", 11: "10A"}
    return (major if mode == "major" else minor)[tonic]


def _chord_templates() -> tuple[np.ndarray, list[str]]:
    templates: list[np.ndarray] = []
    labels: list[str] = []
    qualities = {
        "": (0, 4, 7),
        "m": (0, 3, 7),
        "dim": (0, 3, 6),
        "sus4": (0, 5, 7),
    }
    for root in range(12):
        for suffix, intervals in qualities.items():
            template = np.full(12, 0.04, dtype=np.float64)
            for weight, interval in zip((1.0, 0.82, 0.72), intervals, strict=True):
                template[(root + interval) % 12] = weight
            template /= np.linalg.norm(template)
            templates.append(template)
            labels.append(f"{PITCHES[root]}{suffix}")
    return np.stack(templates), labels


CHORD_TEMPLATES, CHORD_LABELS = _chord_templates()


def _estimate_chords(y: np.ndarray, sr: int, selection_start: float) -> dict[str, Any]:
    if len(y) < sr // 2:
        return {"progression": [], "segments": [], "confidence": 0.0}
    harmonic = librosa.effects.harmonic(y, margin=3.0)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=hop)
    _, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop, units="frames")
    boundaries = np.unique(np.concatenate(([0], beat_frames, [chroma.shape[1]]))).astype(int)
    boundaries = boundaries[(boundaries >= 0) & (boundaries <= chroma.shape[1])]
    if len(boundaries) < 3:
        step = max(1, int(round(0.5 * sr / hop)))
        boundaries = np.arange(0, chroma.shape[1] + step, step)
        boundaries[-1] = chroma.shape[1]

    beat_chroma = librosa.util.sync(chroma, boundaries, aggregate=np.median)
    norms = np.linalg.norm(beat_chroma, axis=0, keepdims=True)
    normalized = beat_chroma / np.maximum(norms, 1e-8)
    scores = CHORD_TEMPLATES @ normalized
    labels = np.argmax(scores, axis=0)
    if labels.size >= 3:
        labels = median_filter(labels, size=3, mode="nearest")

    times = librosa.frames_to_time(boundaries, sr=sr, hop_length=hop)
    segments: list[dict[str, Any]] = []
    for index, label_index in enumerate(labels):
        start = float(times[min(index, len(times) - 1)]) + selection_start
        end = float(times[min(index + 1, len(times) - 1)]) + selection_start
        column = scores[:, index]
        best_two = np.partition(column, -2)[-2:]
        confidence = float(np.clip((best_two[-1] - best_two[-2]) * 2.0 + best_two[-1] * 0.25, 0.0, 1.0))
        label = CHORD_LABELS[int(label_index)]
        if segments and segments[-1]["label"] == label:
            segments[-1]["end"] = end
            segments[-1]["confidence"] = (segments[-1]["confidence"] + confidence) / 2.0
        else:
            segments.append({"label": label, "start": start, "end": end, "confidence": confidence})

    progression = [segment["label"] for segment in segments]
    overall = float(np.mean([segment["confidence"] for segment in segments])) if segments else 0.0
    return {"progression": progression, "segments": segments, "confidence": overall}


def analyze_track(track_dir_value: str, start: float | None, end: float | None, report) -> dict[str, Any]:
    track_dir = Path(track_dir_value).resolve()
    manifest = read_manifest(track_dir)
    working = Path(manifest["working_path"])
    duration = float(manifest["duration"])
    selection_start = max(0.0, float(start or 0.0))
    selection_end = min(duration, float(end if end is not None else duration))
    if selection_end - selection_start < 0.5:
        raise ValueError("Select at least half a second for chord detection.")

    report("analysis", 0.08, "Loading audio")
    y, sr = librosa.load(working, sr=22050, mono=True)
    report("analysis", 0.28, "Finding beats and tempo")
    tempo_value, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=512, units="frames")
    raw_tempo = float(np.asarray(tempo_value).reshape(-1)[0]) if np.asarray(tempo_value).size else 0.0
    tempo, tempo_options = _tempo_candidates(raw_tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=512)
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
    beat_confidence = float(np.clip(np.mean(onset[beat_frames]) / (np.mean(onset) + 1e-8) / 2.0, 0.0, 1.0)) if len(beat_frames) else 0.0

    report("analysis", 0.5, "Detecting musical key")
    harmonic = librosa.effects.harmonic(y, margin=3.0)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=1024)
    key = _estimate_key(chroma)

    report("analysis", 0.72, "Reading chords in the selected region")
    sample_start = int(round(selection_start * sr))
    sample_end = int(round(selection_end * sr))
    chords = _estimate_chords(y[sample_start:sample_end], sr, selection_start)
    analysis = {
        "bpm": round(tempo, 2),
        "bpm_candidates": tempo_options,
        "raw_bpm": round(raw_tempo, 2),
        "bpm_confidence": beat_confidence,
        "beats": [round(float(value), 4) for value in beat_times],
        "key": key,
        "chords": chords,
        "selection": {"start": selection_start, "end": selection_end},
        "analyzed_at": utc_now(),
        "analysis_version": 2,
    }
    manifest["analysis"] = analysis
    manifest["updated_at"] = utc_now()
    write_manifest(track_dir, manifest)
    report("analysis", 1.0, "Analysis complete")
    return analysis
