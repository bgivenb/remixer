# Remixer

Remixer is a local Windows producer workstation for acquiring authorized audio, selecting and previewing waveform regions, detecting musical structure, separating stems on an NVIDIA GPU, and copying Ableton-ready WAV files to the Windows clipboard.

## Launch

Remixer is installed for the current Windows user and has a **Remixer** desktop shortcut.

The generated installer is:

```text
release/Remixer-Setup-0.1.1-x64.exe
```

The app and engine are installed separately so large Python/CUDA dependencies do not make every UI update enormous:

```text
App:     %LOCALAPPDATA%\Programs\Remixer
Engine:  %LOCALAPPDATA%\Remixer\engine
Models:  %LOCALAPPDATA%\Remixer\models
Tracks:  %LOCALAPPDATA%\Remixer\data\tracks
```

## Workflow

1. Paste one YouTube video URL or choose **Import audio**.
2. Choose **New selection**, then drag across the waveform. Use **Adjust** to move the highlighted region or resize its bright edge handles. Press play with **Loop** enabled to confirm it.
3. Select **Detect key, BPM & chords**. Key and BPM describe the track; chords describe the selected region. Click the small alternate value when a half/double-time tempo or key mode is musically ambiguous.
4. Choose **Six stems** or **HQ vocals**.
5. Preview the resulting stems.
6. Use **Full**, **Selection**, **Copy all full**, or **Copy all selection**.
7. Paste the files into Explorer or another Windows file-list destination. From Explorer they can be imported into Ableton Live. Direct paste behavior inside Live can vary by version and focused view.

Selections are rendered sample-accurately as 32-bit float WAV files. Stems are never normalized independently, so their relative balance and alignment are preserved.

## Separation models

- **Six stems:** `roformer-model-bs-roformer-sw-by-jarredou` / BS-RoFormer SW Fixed
- **HQ vocals:** `roformer-model-bs-roformer-leap-xe-vocals-by-pcunwa` / Leap XE
- **Backend:** `bs-roformer-infer` pinned to commit `b0f1386fcced25f559f3e61c9f08a73cd9bddf80`
- **Compute:** CUDA-enabled PyTorch 2.11 on the RTX 3080, with an explicit slower CPU fallback

Checkpoint bytes are not bundled in the installer. The backend downloads them from its pinned registry, validates their SHA-256 hashes, and caches them locally. The six-stem checkpoint has already been downloaded and verified on this PC. The Leap XE checkpoint downloads on its first use.

## Audio analysis

The local Python worker uses librosa-based analysis:

- Beat tracking and BPM estimation
- Half/double-time tempo candidates with a switchable working BPM
- Frame-normalized, passage-voted key profiles with Camelot code and mode alternatives
- Beat-synchronized chroma template matching with temporal smoothing for chord segments

Automatic key and chord recognition is probabilistic. Dense mixes, inversions, borrowed chords, and harmony that omits the major/minor third can reduce certainty, so the UI exposes alternatives instead of hiding ambiguity.

Waveforms use compact peaks computed by the local worker, while playback uses byte-range streaming from the source WAV. Long files therefore become seekable without making Chromium decode the entire lossless file into memory first.

## Architecture

```text
Electron + React + WaveSurfer
        │ IPC / JSON-lines
Persistent Python 3.11 worker
        ├── yt-dlp + FFmpeg
        ├── librosa + soundfile
        └── bs-roformer-infer + CUDA PyTorch
                 │
       Cached float-WAV stems and clips
                 │
        Windows CF_HDROP file clipboard
```

No local web server, UVR GUI, Docker, Demucs, or ONNX Runtime is used.

## Development

```powershell
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\setup-engine.ps1
npm run dev
```

Build and package:

```powershell
npm run typecheck
npm test
npm run build
npm run package
```

Python tests:

```powershell
$env:PYTHONPATH = (Resolve-Path .\worker).Path
& "$env:LOCALAPPDATA\Remixer\engine\.venv\Scripts\python.exe" -m pytest .\worker\tests -q --basetemp .\.pytest-work
```

## Responsible use

Download only audio you own, material in the public domain or under an appropriate license, or content you otherwise have permission to download. The application does not attempt to bypass DRM, authentication, geographic restrictions, or access controls.
