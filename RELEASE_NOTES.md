# Remixer 0.1.2 — One-click setup on Windows and Mac

Remixer is a Given Peace–styled local producer workstation for finding authorized YouTube audio, detecting musical structure, navigating by chord, separating stems with native hardware acceleration, and moving sample-accurate WAVs into a DAW workflow.

## Highlights

- One-click Windows and Apple Silicon setup with no package-manager commands, administrator password, or PATH changes.
- Bundled, checksum-verified platform-native `uv` and LGPL FFmpeg/FFprobe tools.
- Windows privately installs Python 3.11 and CUDA PyTorch, then verifies the NVIDIA device and core model.
- The exact reviewed BS-RoFormer source archive ships with Windows, removing any first-run Git dependency.
- Windows verification is self-contained, forces UTF-8 for model downloads, and removes temporary setup packages when complete.
- Built-in YouTube player and search, featuring Given Peace — Down So Bad.
- Permanent Down So Bad default track and mandatory five-step first-run tutorial.
- Lean 42 MB losslessly compressed base tutorial track; users perform real detection and separation.
- Live current-chord highlighting and click-to-seek in both chord views.
- CUDA six-stem and HQ-vocal separation on Windows with CPU fallback.
- Native MLX/MPS six-stem and HQ-vocal separation on Apple Silicon.
- Explorer- and Finder-compatible native file clipboards for one or many WAVs.
- Given Peace visual system across setup, discovery, workspace, analysis, stems, tutorial, help, and settings.
- 5 GB default project-audio budget, 500 MB minimum, and oldest-inactive offloading that retains lightweight history and analysis.

## Downloads

- `Remixer-Setup-0.1.2-x64.exe` — Windows 10/11 x64 NSIS installer.
- `Remixer-0.1.2-arm64.dmg` — standard Apple Silicon installer image.
- `Remixer-0.1.2-arm64.zip` — portable Apple Silicon application.
- `Down-So-Bad-Tutorial-Project.zip` — reproducible owner-authorized base tutorial asset used by release builds.
- `SHA256SUMS.txt` — checksums for all release artifacts.

## Windows first launch

Install and open Remixer, then select **Set up Remixer**. Remixer supplies its own verified setup/audio tools and reviewed inference source, privately installs Python 3.11 and CUDA-enabled PyTorch, verifies the NVIDIA GPU, and downloads the core six-stem model. No separate dependency page, developer tools, Git installation, commands, or PATH configuration are required. Allow about 5.5 GB of disk space; the optional HQ-vocal model adds roughly 255 MB on first use.

The Windows application installs for the current user, creates Desktop and Start Menu shortcuts, and keeps its engine, model cache, and project library under `%LOCALAPPDATA%\Remixer`.

The Windows installer is unsigned because no Authenticode certificate was provided, so Microsoft Defender SmartScreen may identify it as an unrecognized app. A normal trusted public release requires an appropriate Windows code-signing certificate.

## macOS first launch

Drag Remixer to Applications, open it, and select **Set up Remixer**. Remixer supplies its own verified setup/audio tools, then installs its private Python/ML engine and downloads the core six-stem model. No Homebrew or Terminal work is required. Expect roughly 1.6 GB for that setup. The optional HQ-vocal model downloads only on first use.

The Mac build is unsigned because no Apple Developer ID was provided. After attempting to open it, use **System Settings → Privacy & Security → Open Anyway**. A normal trusted public release requires Apple Developer Program membership, Developer ID signing, and notarization.

## Responsible use

Download and process only audio you own or are authorized to remix. Remixer does not bypass DRM, authentication, geographic restrictions, or access controls. Model licenses and provenance should be reviewed before redistribution or commercial use.
