# Windows Remixer 0.1.2 handoff

Windows now matches the Mac one-click setup experience. The installer ships checksum-verified private `uv`, FFmpeg, FFprobe, and the reviewed BS-RoFormer source; **Set up Remixer** installs private Python/CUDA and the core model without developer tools, Git, commands, or PATH changes.

`Remixer-Setup-0.1.2-x64.exe` is built and installed. Automated tests, clean no-PATH setup, CUDA health, packaged resources, and playback/analysis/separation/clipboard workflows are covered in `WINDOWS_VALIDATION.md`. The original PowerShell hashing and Unicode model-download failures are fixed. The installer remains unsigned, so SmartScreen may warn.
