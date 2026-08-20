# Windows release validation

Validated on August 20, 2026 using Windows 11 Pro 23H2 (build 22631), an NVIDIA GeForce RTX 3080 with 10 GB VRAM, Python 3.11.15, and Torch 2.11.0+cu128.

## Automated checks

- `npm ci` completed with 377 packages and no reported vulnerabilities.
- `npm run typecheck` passed for the renderer and Electron processes.
- `npm test` passed all 6 renderer tests.
- The Python worker suite passed all 11 tests.
- `npm run build` completed the production Electron and Vite builds.
- The Windows PowerShell setup script passed a real idempotent run against `%LOCALAPPDATA%\Remixer\engine`. It verified FFmpeg/FFprobe, CUDA, every required Python package, and the core six-stem checkpoint.
- Live YouTube search returned the official Given Peace `JR2zel8dJts` result first.

## Clean-data end-to-end run

A clean isolated app-data directory expanded the bundled, owner-authorized Down So Bad tutorial project without downloading YouTube audio. The track remained first in Recents and opened on startup.

The five-step tutorial completed from playback through analysis and a real full-track six-stem CUDA run. The source and every result contained exactly 8,017,409 stereo frames at 44.1 kHz in 32-bit float format:

- bass
- drums
- guitar
- instrumental
- other
- piano
- vocals

The full model reported the Torch CUDA backend. A separate exact-length smoke test exercised both production models: the six-stem model produced seven 88,200-frame files, and Leap XE produced two 88,200-frame files. The Leap XE alignment path retained the expected `881559 -> 881152` adjustment.

## Installed NSIS application

The final installer upgraded the existing per-user application successfully and preserved the library and engine. The installed executable reports version 0.1.1. The package is intentionally unsigned because no Authenticode certificate was supplied.

The installed application was exercised directly:

- the native Windows menu bar stays hidden, preserving the intended layout;
- the official YouTube embed loaded from the packaged `file://` renderer without Error 153;
- the mandatory tutorial, existing library, pinned Down So Bad startup track, analysis, CUDA status, and separated-stem rack all loaded correctly;
- playback advanced the transport and active chord highlight;
- a new waveform drag selected `15.280-19.811` seconds;
- Adjust moved it to `17.936-22.467` seconds while preserving its 4.531-second duration;
- Copy all selection published all seven selected stems as a native Windows `CF_HDROP` file list.

The copied payload was pasted into an empty Explorer folder. Explorer received seven distinct, Ableton-ready WAV files. Every pasted file contained exactly 199,815 stereo frames at 44.1 kHz with the `FLOAT` subtype. Filenames carried the stem name, detected `129.2 BPM`, and `E Minor` key metadata.

## Release artifact

`Remixer-Setup-0.1.1-x64.exe` is 149,554,866 bytes.

```text
5138b75ba1f901f99da5a2bdb0fcfba6dfaaa50111524a63f1ee4a7c50286a63  Remixer-Setup-0.1.1-x64.exe
```

The public Windows release remains unsigned. SmartScreen may therefore display an unrecognized-app warning until a trusted Authenticode signing certificate is added.
