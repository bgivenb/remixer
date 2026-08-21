# Windows release validation

Validated on August 20, 2026 using Windows 11 Pro 23H2 (build 22631), an NVIDIA GeForce RTX 3080 with 10 GB VRAM, private Python 3.11.15, and Torch 2.11.0+cu128.

## Automated checks

- `npm ci` completed with 377 packages and no reported vulnerabilities.
- `npm run typecheck` passed for the renderer and Electron processes.
- `npm test -- --run` passed all 6 renderer tests.
- The Python worker suite passed all 11 tests.
- `npm run package` completed the production Electron/Vite build and NSIS packaging.
- The PowerShell parser accepted the final setup script.
- Rebuilding the pinned Windows runtime from its local verified cache passed.

## Clean one-click engine setup

The release setup payload was run against a new, empty `C:`-drive app-data profile with `PATH` limited to Windows system directories. No developer Python, Git, `uv`, FFmpeg, or FFprobe was available.

The setup successfully:

- verified every bundled runtime file with its SHA-256 manifest using Remixer's self-contained .NET hasher;
- installed private `uv` 0.11.21, FFmpeg/FFprobe n8.1.2-44-g7c533d0f86, and Python 3.11.15;
- created a virtual environment backed by Remixer's private Python;
- installed Torch 2.11.0+cu128, the pinned analysis packages, and BS-RoFormer from the bundled reviewed source archive;
- forced UTF-8 subprocess output so the model downloader works under Windows PowerShell's legacy console code page;
- verified the RTX 3080 and selected the Torch CUDA backend;
- downloaded and SHA-256-verified the 699,412,152-byte core six-stem model; and
- removed 4.4 GiB of temporary setup downloads, leaving a 5.38 GiB engine-plus-core-model footprint.

All 19 installed private runtime files matched the packaged manifest. A second setup run completed idempotently. The final installed 0.1.2 application launched under the clean profile directly into the Remixer workspace, with the RTX 3080 active and no setup error.

## Audio workflow regression

The existing installed-app validation remains covered for playback, waveform selection and adjustment, BPM/key/chord analysis, full-track separation, recent-track restoration, and native Windows `CF_HDROP` clipboard export into Explorer/Ableton-ready WAV files.

A fresh exact-length smoke test used the clean private engine and both production models. The six-stem model produced bass, drums, other, vocals, guitar, piano, and instrumental files; Leap XE produced vocals and instrumental files. Every output contained exactly 88,200 stereo frames, both models ran through Torch CUDA, and Leap XE retained its expected `881559 -> 881152` alignment adjustment.

## Installed application and package

The final per-user NSIS installer installed successfully. The executable reports version 0.1.2. The extracted package was checked for the final setup fixes, runtime manifests, private `uv`, FFmpeg, FFprobe, and bundled BS-RoFormer source.

`Remixer-Setup-0.1.2-x64.exe` is 214,304,477 bytes.

```text
eab86acd74219f6abefa4717b5b0b88d7428a5ac94216a34c14eb1e39766b301  Remixer-Setup-0.1.2-x64.exe
```

The public Windows release remains unsigned because no Authenticode certificate was supplied. SmartScreen may therefore display an unrecognized-app warning.
