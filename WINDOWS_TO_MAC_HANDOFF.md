# Windows Remixer 0.1.2 handoff

Windows now matches the Mac one-click setup experience. The installer ships checksum-verified private `uv`, FFmpeg, FFprobe, and the reviewed BS-RoFormer source; **Set up Remixer** installs private Python/CUDA and the core model without developer tools, Git, commands, or PATH changes.

Windows is finished and published in the [v0.1.2 GitHub release](https://github.com/bgivenb/remixer/releases/tag/v0.1.2). `Remixer-Setup-0.1.2-x64.exe` is built, installed, and clean-machine validated; the original PowerShell hashing and Unicode model-download failures are fixed. The Mac agent can add the completed `.dmg` and `.zip` to the same release. The Windows installer remains unsigned, so SmartScreen may warn.
