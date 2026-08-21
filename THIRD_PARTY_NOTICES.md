# Third-party notices

Remixer integrates open-source packages including Electron, React, WaveSurfer.js, yt-dlp, FFmpeg, librosa, NumPy, SciPy, soundfile, PyTorch, MLX, mlx-spectro, and BS-RoFormer-Infer. Their respective licenses and notices apply.

The macOS package includes the official Apple Silicon `uv` 0.11.21 executable under the Apache-2.0 OR MIT license and Remixer-built FFmpeg/FFprobe 8.1.2 executables under LGPL-2.1-or-later. The FFmpeg tools are built from the unmodified release source at `https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz` with external-library autodetection and networking disabled. The package includes the applicable LGPL license texts and a machine-readable runtime manifest with exact source URLs and SHA-256 checksums.

The `bs-roformer-infer` code is MIT licensed. Model checkpoints are downloaded separately at runtime and are not redistributed by this repository or its installer. Upstream checkpoint licensing and provenance should be reviewed before redistributing the application or using outputs commercially.

The user is responsible for ensuring they are authorized to retrieve and process source audio.
