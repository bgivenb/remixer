# Remixer 0.1.1 — Apple Silicon

Remixer is a Given Peace–styled local producer workstation for finding authorized YouTube audio, detecting musical structure, navigating by chord, separating stems with Apple Silicon acceleration, and moving sample-accurate WAVs into a DAW workflow.

## Highlights

- Built-in YouTube player and search, featuring Given Peace — Down So Bad.
- Permanent Down So Bad default track and mandatory five-step first-run tutorial.
- Lean 42 MB losslessly compressed base tutorial track; users perform real detection and separation.
- Live current-chord highlighting and click-to-seek in both chord views.
- Native MLX/MPS six-stem and HQ-vocal separation on Apple Silicon.
- Finder-compatible native file clipboard for one or many WAVs.
- Given Peace visual system across setup, discovery, workspace, analysis, stems, tutorial, help, and settings.
- 5 GB default project-audio budget, 500 MB minimum, and oldest-inactive offloading that retains lightweight history and analysis.

## Downloads

- `Remixer-0.1.1-arm64.dmg` — standard Apple Silicon installer image.
- `Remixer-0.1.1-arm64.zip` — portable Apple Silicon application.
- `Down-So-Bad-Tutorial-Project.zip` — reproducible owner-authorized base tutorial asset used by release builds.
- `SHA256SUMS.txt` — checksums for all three artifacts.

## First launch

Install Homebrew `uv` and FFmpeg first with `brew install uv ffmpeg`. Remixer's one-time setup installs its private Python/ML engine and downloads the core six-stem model from its existing Hugging Face source. Expect roughly 1.6 GB for that setup. The optional HQ-vocal model downloads only on first use.

This build is unsigned because no Apple Developer ID was provided. After attempting to open it, use **System Settings → Privacy & Security → Open Anyway**. A normal trusted public release requires Apple Developer Program membership, Developer ID signing, and notarization.
