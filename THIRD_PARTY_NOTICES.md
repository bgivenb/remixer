# Third-party notices

Remixer integrates open-source packages including Electron, React, WaveSurfer.js, yt-dlp, FFmpeg, librosa, NumPy, SciPy, soundfile, PyTorch, MLX, mlx-spectro, and BS-RoFormer-Infer. Their respective licenses and notices apply.

The macOS package includes the official Apple Silicon `uv` 0.11.21 executable under the Apache-2.0 OR MIT license and Remixer-built FFmpeg/FFprobe 8.1.2 executables under LGPL-2.1-or-later. The FFmpeg tools are built from the unmodified release source at `https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz` with external-library autodetection and networking disabled. The package includes the applicable LGPL license texts and a machine-readable runtime manifest with exact source URLs and SHA-256 checksums.

The Windows package includes the official x64 `uv` 0.11.21 executable under the Apache-2.0 OR MIT license and the pinned BtbN FFmpeg/FFprobe `n8.1.2-44-g7c533d0f86` LGPL shared build from release tag `autobuild-2026-08-20-13-45`. The selected FFmpeg build does not enable GPL or nonfree components. Its upstream FFmpeg source revision is linked from the bundled runtime manifest. The exact reviewed BS-RoFormer-Infer source archive at commit `b0f1386fcced25f559f3e61c9f08a73cd9bddf80` is also included so Windows setup does not require Git. Applicable license texts, source URLs, archive checksums, and per-file SHA-256 values ship with the runtime.

The `bs-roformer-infer` code is MIT licensed. Model checkpoints are downloaded separately at runtime and are not redistributed by this repository or its installer. Upstream checkpoint licensing and provenance should be reviewed before redistributing the application or using outputs commercially.

The user is responsible for ensuring they are authorized to retrieve and process source audio.
