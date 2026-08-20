# Remixer

Remixer is a local Windows and macOS producer workstation for acquiring authorized audio, selecting and previewing waveform regions, detecting musical structure, separating stems with the computer's native accelerator, and copying Ableton-ready WAV files through the operating system's file clipboard.

## Download

- [Download Remixer for Apple Silicon (.dmg)](https://github.com/bgivenb/remixer/releases/latest/download/Remixer-0.1.1-arm64.dmg)
- [Download the portable Mac build (.zip)](https://github.com/bgivenb/remixer/releases/latest/download/Remixer-0.1.1-arm64.zip)
- [Download Remixer for Windows (.exe)](https://github.com/bgivenb/remixer/releases/latest/download/Remixer-Setup-0.1.1-x64.exe)
- [View all releases](https://github.com/bgivenb/remixer/releases)

The current Mac build is unsigned. After the first launch attempt, macOS may require **System Settings → Privacy & Security → Open Anyway**. A normal trusted Developer ID signature and notarization requires Apple Developer Program membership; see the distribution note below.

The current Windows installer is also unsigned because no Authenticode certificate was provided. Microsoft Defender SmartScreen may show an unrecognized-app warning; a public trusted Windows release requires an appropriate code-signing certificate.

The entire interface follows the stark editorial visual system of [givenpeace.com](https://www.givenpeace.com/): black and white surfaces, condensed display type, sharp borders, and minimal decoration. The built-in YouTube browser opens on Given Peace's **Down So Bad** official video, lets listeners search YouTube without leaving Remixer, and can send the selected video directly into the existing audio-import workflow. Down So Bad is also the permanent pinned default track: the app installs its bundled base audio on a clean launch, opens it at startup, and never lets ordinary recent-history ordering displace it.

Release packages include the losslessly compressed Down So Bad base track and thumbnail, not hundreds of megabytes of pre-rendered stems. The first-run five-step walkthrough uses this track exclusively and guides the user through playback, detection, chord navigation, and their first real six-stem separation. The Help button remains available afterward.

Settings includes a project-audio budget with a 5 GB default and a 500 MB minimum. When usage exceeds the limit, Remixer offloads the oldest inactive project audio while retaining its lightweight history, source reference, thumbnail, BPM, key, selections, and chord map. Opening an offloaded project restores its source; stems can then be regenerated as needed. The active project and bundled tutorial are protected from automatic offloading.

## Desktop releases

The supported targets are Windows 10/11 on x64 with an NVIDIA CUDA GPU and Apple Silicon (`arm64`) on macOS 12 or newer. Build artifacts are written to `release/`:

```text
release/Remixer-Setup-0.1.1-x64.exe
release/Remixer-0.1.1-arm64.dmg
release/Remixer-0.1.1-arm64.zip
```

The completed Windows release checklist and measured results are recorded in [WINDOWS_VALIDATION.md](WINDOWS_VALIDATION.md).

The UI and audio engine are installed separately so model and Python dependencies do not make every UI update enormous:

```text
Windows app:    %LOCALAPPDATA%\Programs\Remixer
Windows engine: %LOCALAPPDATA%\Remixer\engine
Windows models: %LOCALAPPDATA%\Remixer\models
Windows tracks: %LOCALAPPDATA%\Remixer\data\tracks

Mac app data:   ~/Library/Application Support/Remixer
Mac engine:     ~/Library/Application Support/Remixer/engine
Mac models:     ~/Library/Application Support/Remixer/models
Mac tracks:     ~/Library/Application Support/Remixer/data/tracks
```

The local development build is unsigned. A distributable release still needs the owner's Developer ID signing identity, hardened-runtime entitlements, notarization, and stapling.

There is no legitimate no-fee Developer ID/notarization route for unrestricted public Mac distribution. Apple allows free development and personal testing, but Developer ID and notarization are part of the $99/year Apple Developer Program. Eligible nonprofits, accredited educational institutions, and government entities can request Apple's fee waiver. Until enrollment, releases remain unsigned and users must explicitly approve them in macOS Privacy & Security.

## Installed size

Approximate Apple Silicon footprint after first setup:

- Download package with the bundled base tutorial track: about 159 MB compressed; the installed `.app` is about 347 MB.
- Private Python/ML audio engine: about 924 MB.
- Core six-stem model installed during setup: about 667 MB on disk (~699 MB advertised download).
- Optional HQ-vocal model: about 255 MB on disk (~268 MB advertised download).
- Expanded Down So Bad base track: about 61 MB.

With both models and the expanded base tutorial installed, the fixed baseline is roughly 2.2 GB before user projects. The 5 GB storage preference applies only to growing project audio, not the shared engine or model cache.

The verified Windows footprint is approximately 4.5 GB for the private CUDA engine, 667 MB for the core six-stem model, 255 MB for the optional HQ-vocal model, and 61 MB for the expanded tutorial. Allow about 5.2 GB for first setup or 5.5 GB with both models. The same 5 GB preference applies only to project audio.

## First launch

On Windows, install `uv`, FFmpeg, and FFprobe on `PATH`, then open Remixer and select **Install audio engine**. The setup creates a private Python 3.11 environment, installs CUDA-enabled PyTorch, verifies the RTX/NVIDIA device, and downloads the core six-stem checkpoint. The optional HQ-vocal model is downloaded on first use.

On macOS, install Homebrew `uv` and FFmpeg once:

```bash
brew install uv ffmpeg
```

Open Remixer and select **Install audio engine**. The app finds Homebrew tools even when it is launched from Finder, installs an arm64 Python 3.11 environment, verifies MLX, Torch MPS, FFmpeg, and FFprobe, and downloads/verifies the core six-stem checkpoint. The optional HQ-vocal model remains an on-demand first-use download.

## Workflow

1. Play or search YouTube in the built-in browser, choose **Remix this song**, paste another authorized YouTube video URL, or choose **Import audio**. The featured example is [Given Peace — Down So Bad](https://www.youtube.com/watch?v=JR2zel8dJts).
2. Choose **New selection**, then drag across the waveform. Use **Adjust** to move the highlighted region or resize its bright edge handles. Press play with **Loop** enabled to confirm it.
3. Select **Detect key, BPM & chords**. Key and BPM describe the track; chords describe the selected region. The chord playing at the current transport time is highlighted in both the waveform and progression, and every chord can be clicked to seek directly to its start. Alternate tempo and key choices remain available for musical ambiguity.
4. Choose **Six stems** or **HQ vocals**.
5. Preview the resulting stems.
6. Use **Full**, **Selection**, **Copy all full**, or **Copy all selection**.
7. Paste one or more file items into Explorer or Finder, then drag or import them into Ableton Live as needed. **Files** remains the reliable fallback for Live views that do not accept a direct paste.

Selections are rendered sample-accurately as 32-bit float WAV files. Stems are never normalized independently, so their relative balance and alignment are preserved.

## Separation models

- **Six stems:** `roformer-model-bs-roformer-sw-by-jarredou` / BS-RoFormer SW Fixed
- **HQ vocals:** `roformer-model-bs-roformer-leap-xe-vocals-by-pcunwa` / Leap XE
- **Engine:** `bs-roformer-infer` pinned to commit `b0f1386fcced25f559f3e61c9f08a73cd9bddf80`
- **Windows compute order:** Torch CUDA, then Torch CPU
- **Mac compute order:** native MLX, Torch MPS, then Torch CPU

The Apple Silicon engine pins Torch 2.11.0, MLX 0.31.0, and mlx-spectro 0.7.0. Both named models have been exercised through MLX with exact input/output frame-count validation. Leap XE keeps the STFT-hop chunk alignment fix (`881559 -> 881152`).

## Audio analysis

The local worker uses librosa for beat tracking, selectable half/double-time BPM candidates, passage-voted key profiles with Camelot codes, and beat-synchronized chord matching. These estimates are probabilistic, so the UI exposes alternatives instead of hiding ambiguity.

Waveforms use compact peaks computed by the persistent worker. Playback uses byte-range streaming from the lossless working WAV, so long files remain seekable without sending full decoded audio arrays over IPC.

## YouTube discovery

The official `youtube-nocookie.com` embed is used for playback, while search metadata is obtained locally through the installed yt-dlp engine. The packaged desktop player identifies itself with the first-party `givenpeace.com` HTTP referrer, as required by YouTube's embedded-player policy; no YouTube API key or hosted Remixer service is required. Electron context isolation remains enabled and the remote player is not granted Node.js access. Processing remains subject to the responsible-use requirements below.

## Development

Windows:

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File .\scripts\setup-engine.ps1
npm run build:tutorial
npm run typecheck
npm test
$env:PYTHONPATH = (Resolve-Path .\worker).Path
& "$env:LOCALAPPDATA\Remixer\engine\.venv\Scripts\python.exe" -m pytest .\worker\tests -q
npm run dev
```

macOS:

```bash
brew install uv ffmpeg
npm ci
npm run build:mac-helper
npm run build:tutorial
./scripts/setup-engine.sh "$HOME/Library/Application Support/Remixer/engine"
npm run typecheck
npm test
PYTHONPATH="$PWD/worker" "$HOME/Library/Application Support/Remixer/engine/.venv/bin/python" -m pytest worker/tests -q
npm run dev
```

Build and package the native release for the current host (NSIS on Windows, unsigned DMG/ZIP on macOS):

```bash
npm run package
```

`build:tutorial` uses the owner-authorized base track at the normal Remixer app-data path. A release builder can override it with `REMIXER_TUTORIAL_SOURCE`. When no local source/archive exists, the script downloads the pinned `v0.1.1` release asset and verifies its SHA-256 before packaging. The generated archive stays in `build-tools/` and is intentionally not committed as source.

`scripts/package.mjs` selects DMG/ZIP on macOS and retains the existing NSIS path on Windows. Windows CUDA setup and `CF_HDROP` clipboard support remain behind platform dispatch.

## Responsible use

Download only audio you own, material in the public domain or under an appropriate license, or content you otherwise have permission to download. Remixer does not bypass DRM, authentication, geographic restrictions, or access controls. Model licenses and provenance should be reviewed before redistribution or commercial use.
