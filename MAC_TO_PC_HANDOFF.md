# Remixer Mac-to-PC handoff

## What this handoff contains

The macOS port is complete and the shared application now includes eight product changes that should be carried into the next Windows build:

1. A whole-app Given Peace visual system based on [givenpeace.com](https://www.givenpeace.com/): monochrome surfaces, condensed uppercase headings, hard borders, editorial spacing, and black media panels.
2. An in-app YouTube player and search browser. The default featured example is [Given Peace — Down So Bad (Official Music Video)](https://www.youtube.com/watch?v=JR2zel8dJts), ID `JR2zel8dJts`, and a selected result can be sent directly to the existing Remixer download workflow.
   Down So Bad is also a permanent first item in Recents and the startup track. Existing cached audio opens immediately; a clean installation expands the bundled, owner-authorized base asset without a network request. The virtual pinned item remains available if its local manifest is removed.
   `build-tools/Down-So-Bad-Tutorial-Project.zip` contains only the owner-authorized base track and thumbnail. `ensure_tutorial` expands it locally; the five-step tutorial guides the user through real detection and six-stem separation. Do not re-bundle rendered stems.
3. Live chord highlighting in both the waveform timeline and progression row.
4. Click-to-seek on every displayed chord, using the segment's exact start time.
5. One-click first-run setup with no separate setup page, dependency link, package-manager command, or manual PATH configuration. Remixer v0.1.3 ships verified private `uv`, FFmpeg, and FFprobe tools for each platform and installs its private Python engine/model after the user clicks **Set up Remixer**. Windows preserves its CUDA-specific engine path.
6. A welcome modal on every normal app launch after setup/onboarding. It uses the approved Given Peace support copy, links to the canonical Beatport artist page at `https://www.beatport.com/artist/given-peace/1153686`, keeps the Beatport action secondary, and places a larger **Continue** button directly below it.
7. The tutorial always exposes its top-right close button, including before completion. Closing returns to the app immediately without marking the tutorial complete, so an incomplete walkthrough may appear again on the next launch.
8. Remixer uses the exact favicon declared by `givenpeace.com` as its header logo and application icon. The pinned 300×300 RGBA PNG is stored as `assets/given-peace-favicon.base64` with source SHA-256 `de165817dd3665ccb43f7afbe3400a80bd2595a97cf0be4079320333040c50b7`; `scripts/build-icon.mjs` verifies it and deterministically creates the 512×512 package icon required by Electron Builder.

The Mac work preserves the existing Windows platform branches for CUDA setup, native `CF_HDROP` file clipboard behavior, NSIS packaging, and PowerShell engine installation.

## Shared files to merge

- `src/renderer/App.tsx` — YouTube browser integration, transport-time state, chord seek requests.
- `src/renderer/components/YouTubeBrowser.tsx` — featured player, local search UI, and send-to-Remixer controls.
- `src/renderer/components/WaveformEditor.tsx` — current-time reporting, live chord state, timeline buttons, external seek handling.
- `src/renderer/styles.css` — the full Given Peace visual system, including all setup, workspace, waveform, stem, modal, and YouTube surfaces.
- `src/renderer/types.ts` — `YouTubeVideo` result type.
- `src/renderer/mock-api.ts` — featured/search data for browser-level UI testing.
- `src/renderer/featured.ts` — single source of truth for the default video plus featured-track recognition/pinning.
- `src/renderer/components/Tutorial.tsx` and `HelpCenter.tsx` — first-run walkthrough with an always-available close control plus persistent help reference.
- `src/renderer/components/WelcomeSupport.tsx` — launch welcome, canonical Beatport action, and prominent Continue control.
- `assets/given-peace-favicon.base64`, `src/renderer/App.tsx`, and `scripts/build-icon.mjs` — exact Given Peace favicon source, header rendering, checksum verification, and cross-platform 512×512 package-icon generation.
- `scripts/prepare-tutorial-project.mjs` and `worker/remixer_worker/tutorial.py` — lossless tutorial archive preparation and safe local installation.
- `worker/remixer_worker/storage.py` and `src/renderer/components/StorageSettings.tsx` — 5 GB project-audio budget, oldest-inactive offloading, retained lightweight history, manual offload, and source restoration.
- `src/electron/main/main.ts` — packaged desktop-player HTTP referrer identity in addition to the existing platform/lifecycle changes.
- `worker/remixer_worker/youtube.py` — yt-dlp flat-metadata search with no API key.
- `worker/remixer_worker/__main__.py` — `search_youtube` worker command dispatch.
- `worker/tests/test_youtube.py` — search-result normalization regression test.
- `README.md` — new discovery, chord-navigation, design-system, and Mac documentation.

## Windows behavior that must remain platform-specific

Do not replace these working Windows paths with their Mac equivalents:

- Keep `scripts/setup-engine.ps1` and the Windows CUDA wheels/setup flow, but make it self-contained: package or securely acquire pinned, checksum-verified Windows `uv`, FFmpeg, and FFprobe builds and install/use them privately. A clean Windows machine must not require users to install developer tools, visit a setup link, run commands, or edit `PATH`.
- Keep `.venv\\Scripts\\python.exe` discovery in `src/electron/worker-client.ts`.
- Keep CUDA first, then CPU, in the Windows branch of `worker/remixer_worker/separation.py`.
- Keep native Windows `CF_HDROP` clipboard publication in `src/electron/clipboard.ts`.
- Keep the NSIS target selected by `scripts/package.mjs` on Windows.
- Keep the macOS Swift helper and MLX/MPS branches behind Darwin-only dispatch.

## PC-agent validation checklist

Run these on the actual Windows target after merging:

1. `npm ci`, `npm run typecheck`, `npm test`, and the Python worker test suite.
2. Launch both development and packaged NSIS builds and confirm the official Down So Bad player is visible by default.
3. Search for `Given Peace Down So Bad`; confirm `JR2zel8dJts` is the first official result and selecting it updates the embed.
4. Test both a clean app-data directory and an existing library: Down So Bad must stay first in Recents and open as the startup track. On the clean directory it should expand from the bundled base archive without downloading YouTube audio; thereafter it should use the cached working WAV.
5. Use **Remix this song** and confirm it reaches the existing authorized-download flow unchanged.
6. Import/analyze a track, play through multiple chord boundaries, and confirm the active highlight advances in both chord displays.
7. Click chords in both the progression row and waveform timeline; confirm the transport seeks to each exact timestamp.
8. Check the complete UI at the Windows release's minimum and typical display sizes. The visual system must cover first-launch setup, intake, YouTube, workspace, analysis, stem rack, model download, empty/error states, and dialogs—not only the new panel.
9. Re-run one real CUDA separation for each named model and confirm exact output length/alignment.
10. Copy one and multiple rendered WAVs through `CF_HDROP`, including filenames with spaces and Unicode.
11. Build the NSIS installer and inspect its packaged worker resources for `remixer_worker/youtube.py`.
12. On a clean Windows user profile with no `uv`, FFmpeg, or FFprobe on `PATH`, open the packaged app and complete setup entirely through the Remixer UI. Confirm the private tools, Python/CUDA engine, and core model are installed automatically; then complete analysis and separation. The app and website must not send users to a separate dependency-setup link.
13. Complete setup/onboarding and confirm the Given Peace welcome appears on every new app launch. Verify the exact approved copy, the canonical Beatport URL, the secondary Beatport button, and the larger **Continue** button beneath it. Continue must dismiss the modal without reopening it during the same renderer session.
14. With the tutorial incomplete, confirm its top-right close button is visible and immediately returns to the workspace. Closing must not mark the walkthrough complete; relaunching may present the unfinished tutorial again, followed by the welcome when onboarding is no longer covering it.
15. Confirm the Given Peace favicon is visible in the app header and the installed application/shortcut icon. Run `npm run build:icon`, verify a 512×512 RGBA PNG is produced, and inspect the NSIS package to ensure the same mark is used on Windows rather than the previous waveform icon.

yt-dlp search does not require an API key. It produced a benign warning about the lack of a supported JavaScript runtime on the tested Mac but returned correct search metadata. If a future yt-dlp release requires a runtime for specific extraction paths on Windows, configure a supported runtime through the normal engine installation rather than embedding credentials or scraping a separate service.

Important: packaged Electron renderers load from `file://`, which omits the HTTP referrer and causes YouTube player Error 153. `installYouTubeClientIdentity()` sets the embedded frame request's referrer to the first-party `https://www.givenpeace.com/` identity, and the iframe supplies matching `origin`/`widget_referrer` parameters. Preserve and explicitly validate this hook in the Windows package.

## macOS implementation and validation

- Target: Apple Silicon (`arm64`), macOS 12+.
- Engine: arm64 Python 3.11 under `~/Library/Application Support/Remixer/engine`.
- Compute order: native MLX, Torch MPS, then Torch CPU.
- The 0.1.3 Mac package bundles verified Apple Silicon `uv`, FFmpeg, FFprobe, and a tiny macOS 12 `realpath` compatibility helper. First-run setup requires one in-app click and no Homebrew, Terminal work, administrator password, or PATH changes.
- Because setup is handled inside the app, the public website can remove its separate Mac setup/dependency link. Remove the equivalent Windows setup link after the Windows clean-machine validation above passes; retain only a short note that first setup is automatic and requires an internet connection and the documented disk space.
- A native Swift pasteboard helper publishes persistent file URLs and was validated by pasting two WAV files with spaces and Unicode into Finder.
- Real six-stem MLX/MPS smoke: all 7 files contained exactly 88,200 frames.
- Real Leap XE MLX/MPS smoke: both output files contained exactly 88,200 frames.
- Leap XE model chunk alignment remains `881559 -> 881152`.
- Renderer tests: 9 passed.
- Python tests: 11 passed.
- TypeScript typecheck and Vite/Electron production builds passed.
- Live YouTube search returned the official `JR2zel8dJts` result first.
- Live browser validation confirmed the real YouTube embed, search/result controls, progression-row chord seek, timeline chord seek, and automatic active-chord advancement.
- App menu, close/reopen, quit, engine discovery, packaged-resource paths, welcome layout, prominent Continue dismissal, and the Given Peace favicon header logo were exercised from the application. The always-available tutorial close control is covered by a renderer regression test. Electron Builder also produced a valid 512×512 macOS `.icns` from the favicon-derived package icon.

The local Mac package is intentionally unsigned. Public distribution still requires the owner's Apple Developer ID signing identity, hardened runtime, notarization, and stapling. Model weights remain runtime downloads and are not bundled into routine UI releases.

## Security and product boundaries

- Preserve Electron context isolation and the narrow preload API.
- Do not enable `webviewTag`, Node integration, or arbitrary navigation for the embedded player.
- Keep the YouTube embed on `youtube-nocookie.com`.
- Preserve the authorization notice and do not add DRM, authentication, geographic, or access-control bypasses.
- Preserve byte-range media streaming, persistent Python worker/model caching, sample-accurate float WAV rendering, and the no-independent-normalization rule.

## Mac release artifacts

The final local artifacts are:

```text
release/Remixer-0.1.3-arm64.dmg
release/Remixer-0.1.3-arm64.zip
release/Down-So-Bad-Tutorial-Project.zip
release/SHA256SUMS.txt
```

SHA-256 values should be taken from `release/SHA256SUMS.txt` generated with the final package.
