from __future__ import annotations

import gc
import os
from pathlib import Path
from typing import Any

from .files import copy_or_link, models_root, read_manifest, utc_now, write_manifest


MODEL_MODES = {
    "full": "roformer-model-bs-roformer-sw-by-jarredou",
    "vocals": "roformer-model-bs-roformer-leap-xe-vocals-by-pcunwa",
}

_session = None
_loaded_model: str | None = None


def _align_session_chunk_size(session) -> tuple[int, int] | None:
    """Align model chunks to the STFT hop so iSTFT returns equal-length audio."""
    config = getattr(session, "_config", None)
    if config is None or not hasattr(config, "model"):
        return None
    hop = int(getattr(config.model, "stft_hop_length", 0) or 0)
    section = None
    if hasattr(config, "inference") and hasattr(config.inference, "chunk_size"):
        section = config.inference
    elif hasattr(config, "audio") and hasattr(config.audio, "chunk_size"):
        section = config.audio
    if section is None or hop <= 0:
        return None
    original = int(section.chunk_size)
    aligned = original - (original % hop)
    if aligned <= 0:
        raise ValueError(f"Invalid separation chunk size {original} for STFT hop {hop}.")
    section.chunk_size = aligned
    return original, aligned


def _release_session() -> None:
    global _session, _loaded_model
    if _session is not None:
        try:
            _session.close()
        except Exception:
            pass
    _session = None
    _loaded_model = None
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


def separate(track_dir_value: str, mode: str, report) -> dict[str, Any]:
    global _session, _loaded_model
    if mode not in MODEL_MODES:
        raise ValueError(f"Unknown separation mode: {mode}")
    model_name = MODEL_MODES[mode]
    track_dir = Path(track_dir_value).resolve()
    manifest = read_manifest(track_dir)
    working = Path(manifest["working_path"])
    output_dir = track_dir / "stems" / mode
    output_dir.mkdir(parents=True, exist_ok=True)

    existing_set = manifest.get("stem_sets", {}).get(mode)
    if existing_set and all(Path(value).exists() for value in existing_set.get("paths", {}).values()):
        report("separation", 1.0, "Using cached stems")
        return existing_set

    report("model", 0.03, "Preparing separation model")
    from bs_roformer import BSRoformerSession

    if _session is None or _loaded_model != model_name:
        _release_session()
        _session = BSRoformerSession(
            model_name=model_name,
            models_dir=models_root(),
            device="cuda",
            backend="torch",
            progress=False,
        )
        report("model", 0.08, "Downloading or verifying model weights")
        try:
            _session.load()
        except RuntimeError as exc:
            if "cuda" in str(exc).lower():
                _release_session()
                _session = BSRoformerSession(
                    model_name=model_name,
                    models_dir=models_root(),
                    device="cpu",
                    backend="torch",
                    progress=False,
                )
                report("model", 0.08, "CUDA unavailable; loading the slower CPU fallback")
                _session.load()
            else:
                raise
        _loaded_model = model_name

    chunk_alignment = _align_session_chunk_size(_session)
    if chunk_alignment and chunk_alignment[0] != chunk_alignment[1]:
        report(
            "model",
            0.12,
            f"Aligned model chunk {chunk_alignment[0]} to {chunk_alignment[1]} samples for exact output length",
        )

    input_dir = track_dir / "inference-input"
    input_dir.mkdir(parents=True, exist_ok=True)
    input_file = input_dir / "track.wav"
    copy_or_link(working, input_file)
    report("separation", 0.18, "Separating stems on the GPU")
    try:
        output_manifest = _session.infer(input_dir, store_dir=output_dir, verbose=True, output_format="wav_float32")
    except RuntimeError as exc:
        if "out of memory" in str(exc).lower():
            _release_session()
            raise RuntimeError("The GPU ran out of memory during separation. Close other GPU-heavy apps and try again.") from exc
        raise

    paths = {entry.output_id: str(Path(entry.output_path).resolve()) for entry in output_manifest.outputs}
    stem_set = {
        "mode": mode,
        "model": model_name,
        "device": str(getattr(_session, "device", "unknown")),
        "paths": paths,
        "created_at": utc_now(),
    }
    stem_sets = manifest.get("stem_sets", {})
    stem_sets[mode] = stem_set
    manifest["stem_sets"] = stem_sets
    manifest["updated_at"] = utc_now()
    write_manifest(track_dir, manifest)
    report("separation", 1.0, f"Created {len(paths)} stems")
    return stem_set


def release_models() -> dict[str, bool]:
    _release_session()
    return {"released": True}
