from __future__ import annotations

import importlib.util
import shutil
import sys
from typing import Any


def health() -> dict[str, Any]:
    packages = {
        name: importlib.util.find_spec(name) is not None
        for name in ("numpy", "librosa", "soundfile", "yt_dlp", "torch", "bs_roformer")
    }
    cuda = {"available": False, "device": None, "vram_gb": None}
    if packages["torch"]:
        import torch

        cuda["available"] = bool(torch.cuda.is_available())
        if cuda["available"]:
            properties = torch.cuda.get_device_properties(0)
            cuda["device"] = properties.name
            cuda["vram_gb"] = round(properties.total_memory / (1024**3), 1)
    return {
        "python": sys.version.split()[0],
        "packages": packages,
        "ffmpeg": shutil.which("ffmpeg"),
        "ffprobe": shutil.which("ffprobe"),
        "cuda": cuda,
        "ready": all(packages.values()) and bool(shutil.which("ffmpeg")) and bool(shutil.which("ffprobe")),
    }

