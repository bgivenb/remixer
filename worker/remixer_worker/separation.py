from __future__ import annotations

import gc
import importlib.util
import platform
from pathlib import Path
from typing import Any

from .files import copy_or_link, models_root, read_manifest, utc_now, write_manifest


MODEL_MODES = {
    "full": "roformer-model-bs-roformer-sw-by-jarredou",
    "vocals": "roformer-model-bs-roformer-leap-xe-vocals-by-pcunwa",
}

_session = None
_loaded_model: str | None = None
_loaded_backend: str | None = None
_loaded_device: str | None = None


def separation_backend_status(*, mlx_available: bool, mps_available: bool, cuda_available: bool) -> dict[str, Any]:
    if _session is not None and _loaded_backend and _loaded_device:
        return {"backend": _loaded_backend, "device": _loaded_device, "status": "loaded"}
    if mlx_available:
        return {"backend": "mlx", "device": "mps", "status": "preferred"}
    if cuda_available:
        return {"backend": "torch", "device": "cuda", "status": "preferred"}
    if mps_available:
        return {"backend": "torch", "device": "mps", "status": "preferred"}
    return {"backend": "torch", "device": "cpu", "status": "preferred"}


def _session_candidates() -> list[tuple[str, str, str]]:
    candidates: list[tuple[str, str, str]] = []
    if platform.system() == "Darwin" and platform.machine() == "arm64":
        if importlib.util.find_spec("mlx") is not None and importlib.util.find_spec("mlx_spectro") is not None:
            candidates.append(("mlx", "mps", "native Apple MLX"))
        try:
            import torch

            mps_backend = getattr(torch.backends, "mps", None)
            if mps_backend is not None and mps_backend.is_available():
                candidates.append(("torch", "mps", "PyTorch MPS"))
        except ImportError:
            pass
    else:
        try:
            import torch

            if torch.cuda.is_available():
                candidates.append(("torch", "cuda", "PyTorch CUDA"))
        except ImportError:
            pass
    candidates.append(("torch", "cpu", "PyTorch CPU"))
    return candidates


def _align_config_payload(payload: dict[str, Any]) -> tuple[int, int] | None:
    model = payload.get("model") or {}
    hop = int(model.get("stft_hop_length") or 0)
    section = None
    inference = payload.get("inference") or {}
    audio = payload.get("audio") or {}
    if "chunk_size" in inference:
        section = inference
    elif "chunk_size" in audio:
        section = audio
    if section is None or hop <= 0:
        return None
    original = int(section["chunk_size"])
    aligned = original - (original % hop)
    if aligned <= 0:
        raise ValueError(f"Invalid separation chunk size {original} for STFT hop {hop}.")
    section["chunk_size"] = aligned
    return original, aligned


def _model_assets(model_name: str) -> tuple[Path, Path, tuple[int, int] | None]:
    import yaml
    from bs_roformer.download import ensure_model_assets
    from bs_roformer.inference import SafeLoaderWithTuple

    checkpoint_path, config_path = ensure_model_assets(model_name, models_dir=models_root())
    with config_path.open(encoding="utf-8") as handle:
        payload = yaml.load(handle, Loader=SafeLoaderWithTuple)
    alignment = _align_config_payload(payload)
    if not alignment or alignment[0] == alignment[1]:
        return Path(checkpoint_path), Path(config_path), alignment

    aligned_root = models_root() / "aligned-configs"
    aligned_root.mkdir(parents=True, exist_ok=True)
    aligned_path = aligned_root / f"{model_name}.yaml"
    temporary = aligned_path.with_suffix(".tmp")
    temporary.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")
    temporary.replace(aligned_path)
    return Path(checkpoint_path), aligned_path, alignment


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
    global _session, _loaded_model, _loaded_backend, _loaded_device
    if _session is not None:
        try:
            _session.close()
        except Exception:
            pass
    _session = None
    _loaded_model = None
    _loaded_backend = None
    _loaded_device = None
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        mps_backend = getattr(torch.backends, "mps", None)
        if mps_backend is not None and mps_backend.is_available():
            torch.mps.empty_cache()
    except ImportError:
        pass
    try:
        import mlx.core as mx

        mx.clear_cache()
    except (ImportError, AttributeError):
        pass


def separate(track_dir_value: str, mode: str, report) -> dict[str, Any]:
    global _session, _loaded_model, _loaded_backend, _loaded_device
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
        report("model", 0.08, "Downloading or verifying model weights")
        checkpoint_path, config_path, asset_alignment = _model_assets(model_name)
        errors: list[str] = []
        for backend, device, label in _session_candidates():
            report("model", 0.1, f"Loading with {label}")
            candidate = BSRoformerSession(
                model_name=model_name,
                model_path=checkpoint_path,
                config_path=config_path,
                models_dir=models_root(),
                device=device,
                backend=backend,
                progress=False,
            )
            try:
                candidate.load()
                _session = candidate
                _loaded_model = model_name
                _loaded_backend = str(getattr(candidate, "backend", backend))
                _loaded_device = str(getattr(candidate, "device", device))
                break
            except Exception as exc:
                errors.append(f"{label}: {exc}")
                try:
                    candidate.close()
                except Exception:
                    pass
        if _session is None:
            raise RuntimeError("No separation backend could load the model. " + " | ".join(errors))
    else:
        asset_alignment = None

    chunk_alignment = _align_session_chunk_size(_session)
    effective_alignment = asset_alignment or chunk_alignment
    if effective_alignment and effective_alignment[0] != effective_alignment[1]:
        report(
            "model",
            0.12,
            f"Aligned model chunk {effective_alignment[0]} to {effective_alignment[1]} samples for exact output length",
        )

    input_dir = track_dir / "inference-input"
    input_dir.mkdir(parents=True, exist_ok=True)
    input_file = input_dir / "track.wav"
    copy_or_link(working, input_file)
    report("separation", 0.18, f"Separating stems with {_loaded_backend} on {_loaded_device}")
    try:
        output_manifest = _session.infer(input_dir, store_dir=output_dir, verbose=True, output_format="wav_float32")
    except RuntimeError as exc:
        if "out of memory" in str(exc).lower() or "allocation" in str(exc).lower():
            _release_session()
            raise RuntimeError("The separation device ran out of memory. Close other memory-heavy apps and try again.") from exc
        raise

    paths = {entry.output_id: str(Path(entry.output_path).resolve()) for entry in output_manifest.outputs}
    stem_set = {
        "mode": mode,
        "model": model_name,
        "backend": _loaded_backend,
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


def prepare_model(mode: str, report) -> dict[str, Any]:
    if mode not in MODEL_MODES:
        raise ValueError(f"Unknown separation mode: {mode}")
    model_name = MODEL_MODES[mode]
    report("model", 0.05, "Downloading or verifying the core separation model")
    checkpoint_path, config_path, _alignment = _model_assets(model_name)
    report("model", 1.0, "Core separation model ready")
    return {"mode": mode, "model": model_name, "checkpoint": str(checkpoint_path), "config": str(config_path)}


def release_models() -> dict[str, bool]:
    _release_session()
    return {"released": True}
