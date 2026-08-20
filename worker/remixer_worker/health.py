from __future__ import annotations

import importlib.util
import platform
import shutil
import sys
from typing import Any


def health() -> dict[str, Any]:
    required_packages = ("numpy", "librosa", "soundfile", "yt_dlp", "torch", "bs_roformer")
    packages = {
        name: importlib.util.find_spec(name) is not None
        for name in (*required_packages, "mlx", "mlx_spectro")
    }
    cuda = {"available": False, "device": None, "vram_gb": None}
    mps = {"available": False, "built": False}
    if packages["torch"]:
        import torch

        cuda["available"] = bool(torch.cuda.is_available())
        if cuda["available"]:
            properties = torch.cuda.get_device_properties(0)
            cuda["device"] = properties.name
            cuda["vram_gb"] = round(properties.total_memory / (1024**3), 1)
        mps_backend = getattr(torch.backends, "mps", None)
        if mps_backend is not None:
            mps["built"] = bool(mps_backend.is_built())
            mps["available"] = bool(mps_backend.is_available())

    mlx = {
        "available": bool(
            platform.system() == "Darwin"
            and platform.machine() == "arm64"
            and packages["mlx"]
            and packages["mlx_spectro"]
        ),
        "device": "Apple Silicon GPU" if platform.system() == "Darwin" and platform.machine() == "arm64" else None,
    }
    from .separation import separation_backend_status

    separation = separation_backend_status(mlx_available=mlx["available"], mps_available=mps["available"], cuda_available=cuda["available"])
    ffmpeg = shutil.which("ffmpeg")
    ffprobe = shutil.which("ffprobe")
    return {
        "python": sys.version.split()[0],
        "packages": packages,
        "ffmpeg": ffmpeg,
        "ffprobe": ffprobe,
        "cuda": cuda,
        "mps": mps,
        "mlx": mlx,
        "separation": separation,
        "ready": all(packages[name] for name in required_packages) and bool(ffmpeg) and bool(ffprobe),
    }
