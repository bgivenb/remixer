[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Remixer\engine')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..\worker'))
$installPath = [System.IO.Path]::GetFullPath($InstallRoot)
$venvPath = Join-Path $installPath '.venv'
$pythonPath = Join-Path $venvPath 'Scripts\python.exe'

if (-not (Test-Path -LiteralPath $workerRoot -PathType Container)) {
    throw "Worker sources were not found at $workerRoot"
}

$uvCommand = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uvCommand) {
    throw 'uv is required to install the audio engine. Install uv and try again.'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw 'FFmpeg is required and was not found on PATH.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
    throw 'FFprobe is required and was not found on PATH.'
}

New-Item -ItemType Directory -Force -Path $installPath | Out-Null

Write-Output 'Installing the managed Python 3.11 runtime...'
& $uvCommand.Source python install 3.11
if ($LASTEXITCODE -ne 0) { throw 'Unable to install Python 3.11.' }

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    Write-Output 'Creating the Remixer virtual environment...'
    & $uvCommand.Source venv $venvPath --python 3.11 --managed-python
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the Remixer virtual environment.' }
}

Write-Output 'Installing CUDA-enabled PyTorch...'
& $uvCommand.Source pip install --python $pythonPath 'torch==2.11.0' --index-url 'https://download.pytorch.org/whl/cu128'
if ($LASTEXITCODE -ne 0) { throw 'Unable to install CUDA-enabled PyTorch.' }

Write-Output 'Installing audio download and analysis packages...'
& $uvCommand.Source pip install --python $pythonPath --requirements (Join-Path $workerRoot 'requirements-core.txt')
if ($LASTEXITCODE -ne 0) { throw 'Unable to install the core audio packages.' }

Write-Output 'Installing the pinned BS-RoFormer inference engine...'
& $uvCommand.Source pip install --python $pythonPath --requirements (Join-Path $workerRoot 'requirements-engine.txt')
if ($LASTEXITCODE -ne 0) { throw 'Unable to install BS-RoFormer-Infer.' }

Write-Output 'Verifying the engine and GPU...'
$previousPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = $workerRoot
    & $pythonPath -c "import json; from remixer_worker.health import health; print(json.dumps(health(), indent=2))"
    if ($LASTEXITCODE -ne 0) { throw 'The installed audio engine did not pass verification.' }
}
finally {
    $env:PYTHONPATH = $previousPythonPath
}

Write-Output 'Remixer audio engine is ready.'

