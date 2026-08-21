[CmdletBinding()]
param(
    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'Remixer\engine'),
    [string]$BundledToolsRoot = $env:REMIXER_BUNDLED_TOOLS_DIR
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot '..\worker'))
$installPath = [System.IO.Path]::GetFullPath($InstallRoot)
$venvPath = Join-Path $installPath '.venv'
$pythonPath = Join-Path $venvPath 'Scripts\python.exe'
$toolsPath = Join-Path $installPath 'tools'
$ffmpegToolsPath = Join-Path $toolsPath 'ffmpeg'
$appDataPath = Split-Path -Parent $installPath
$dataPath = Join-Path $appDataPath 'data'
$modelsPath = Join-Path $appDataPath 'models'
$roformerArchiveName = 'bs-roformer-infer-b0f1386fcced25f559f3e61c9f08a73cd9bddf80.zip'

function Assert-SafeRuntimePath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "Runtime manifest contains an absolute path: $RelativePath"
    }
    $segments = $RelativePath -split '[\\/]'
    if ($segments -contains '..' -or $segments -contains '') {
        throw "Runtime manifest contains an unsafe path: $RelativePath"
    }
}

function Get-RemixerSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Read-VerifiedRuntimeManifest {
    param([Parameter(Mandatory = $true)][string]$RuntimeRoot)

    $fileManifestPath = Join-Path $RuntimeRoot 'runtime-files.json'
    if (-not (Test-Path -LiteralPath $fileManifestPath -PathType Leaf)) {
        throw 'The packaged Windows runtime manifest is missing. Reinstall Remixer and try again.'
    }
    $fileManifest = Get-Content -LiteralPath $fileManifestPath -Raw | ConvertFrom-Json
    if ($fileManifest.algorithm -ne 'sha256' -or -not $fileManifest.files) {
        throw 'The packaged Windows runtime manifest is invalid. Reinstall Remixer and try again.'
    }
    foreach ($entry in $fileManifest.files.PSObject.Properties) {
        Assert-SafeRuntimePath -RelativePath $entry.Name
        $sourcePath = Join-Path $RuntimeRoot ($entry.Name -replace '/', [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "The packaged setup file is missing: $($entry.Name)"
        }
        $actualHash = Get-RemixerSha256 -Path $sourcePath
        if ($actualHash -ne ([string]$entry.Value).ToLowerInvariant()) {
            throw "The packaged setup file failed verification: $($entry.Name)"
        }
    }
    return $fileManifest
}

function Install-VerifiedRuntime {
    param(
        [Parameter(Mandatory = $true)][string]$RuntimeRoot,
        [Parameter(Mandatory = $true)]$FileManifest
    )

    Write-Output 'Installing Remixer private setup and audio tools...'
    New-Item -ItemType Directory -Force -Path $toolsPath | Out-Null
    foreach ($entry in $FileManifest.files.PSObject.Properties) {
        $relativePath = $entry.Name -replace '/', [System.IO.Path]::DirectorySeparatorChar
        $sourcePath = Join-Path $RuntimeRoot $relativePath
        $destinationPath = Join-Path $toolsPath $relativePath
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
        $copiedHash = Get-RemixerSha256 -Path $destinationPath
        if ($copiedHash -ne ([string]$entry.Value).ToLowerInvariant()) {
            throw "The copied setup file failed verification: $($entry.Name)"
        }
    }
    Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'runtime-files.json') -Destination (Join-Path $toolsPath 'runtime-files.json') -Force
}

if (-not (Test-Path -LiteralPath $workerRoot -PathType Container)) {
    throw "Worker sources were not found at $workerRoot"
}

New-Item -ItemType Directory -Force -Path $installPath | Out-Null

$useBundledTools = $BundledToolsRoot -and (Test-Path -LiteralPath $BundledToolsRoot -PathType Container)
if ($useBundledTools) {
    $runtimeManifest = Read-VerifiedRuntimeManifest -RuntimeRoot $BundledToolsRoot
    Install-VerifiedRuntime -RuntimeRoot $BundledToolsRoot -FileManifest $runtimeManifest
    $uvPath = Join-Path $toolsPath 'uv.exe'
    $ffmpegPath = Join-Path $ffmpegToolsPath 'ffmpeg.exe'
    $ffprobePath = Join-Path $ffmpegToolsPath 'ffprobe.exe'
    $roformerArchive = Join-Path (Join-Path $toolsPath 'vendor') $roformerArchiveName
}
else {
    $uvCommand = Get-Command uv -ErrorAction SilentlyContinue
    $ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
    $ffprobeCommand = Get-Command ffprobe -ErrorAction SilentlyContinue
    if (-not $uvCommand -or -not $ffmpegCommand -or -not $ffprobeCommand) {
        throw 'The packaged setup tools are missing. Reinstall Remixer and try again.'
    }
    Write-Output 'Using developer-provided setup tools...'
    $uvPath = $uvCommand.Source
    $ffmpegPath = $ffmpegCommand.Source
    $ffprobePath = $ffprobeCommand.Source
    $roformerArchive = $null
}

foreach ($requiredTool in @($uvPath, $ffmpegPath, $ffprobePath)) {
    if (-not (Test-Path -LiteralPath $requiredTool -PathType Leaf)) {
        throw "A required private setup tool is missing: $requiredTool"
    }
}

$previousPath = $env:PATH
$previousUvPythonInstallDir = $env:UV_PYTHON_INSTALL_DIR
$previousUvPythonInstallBin = $env:UV_PYTHON_INSTALL_BIN
$previousUvCacheDir = $env:UV_CACHE_DIR
$previousPythonPath = $env:PYTHONPATH
$previousPythonUtf8 = $env:PYTHONUTF8
$previousPythonIoEncoding = $env:PYTHONIOENCODING
$previousDataPath = $env:REMIXER_DATA_DIR
$previousModelsPath = $env:REMIXER_MODELS_DIR

try {
    $privateToolPaths = @($ffmpegToolsPath, $toolsPath) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
    $env:PATH = (@($privateToolPaths) + @($previousPath)) -join [System.IO.Path]::PathSeparator
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $installPath 'python'
    $env:UV_PYTHON_INSTALL_BIN = '0'
    $env:UV_CACHE_DIR = Join-Path $installPath '.uv-cache'
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'

    & $uvPath --version
    if ($LASTEXITCODE -ne 0) { throw 'The private uv executable did not start.' }
    $ffmpegVersionOutput = & $ffmpegPath -version 2>&1
    $ffmpegExitCode = $LASTEXITCODE
    if ($ffmpegExitCode -ne 0) { throw 'The private FFmpeg executable did not start.' }
    $ffmpegVersionOutput | Select-Object -First 1
    $ffprobeVersionOutput = & $ffprobePath -version 2>&1
    $ffprobeExitCode = $LASTEXITCODE
    if ($ffprobeExitCode -ne 0) { throw 'The private FFprobe executable did not start.' }
    $ffprobeVersionOutput | Select-Object -First 1

    Write-Output 'Downloading the private Python 3.11 runtime...'
    & $uvPath python install 3.11
    if ($LASTEXITCODE -ne 0) { throw 'Unable to install Python 3.11.' }

    $venvConfigPath = Join-Path $venvPath 'pyvenv.cfg'
    $venvUsesPrivatePython = $false
    if (Test-Path -LiteralPath $venvConfigPath -PathType Leaf) {
        $venvConfig = Get-Content -LiteralPath $venvConfigPath -Raw
        $venvUsesPrivatePython = $venvConfig.IndexOf($env:UV_PYTHON_INSTALL_DIR, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    }
    if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf) -or -not $venvUsesPrivatePython) {
        if (Test-Path -LiteralPath $venvPath -PathType Container) {
            Write-Output 'Migrating the Remixer virtual environment to its private Python runtime...'
            & $uvPath venv $venvPath --clear --python 3.11 --managed-python
        }
        else {
            Write-Output 'Creating the Remixer virtual environment...'
            & $uvPath venv $venvPath --python 3.11 --managed-python
        }
        if ($LASTEXITCODE -ne 0) { throw 'Unable to create the Remixer virtual environment.' }
    }

    Write-Output 'Installing CUDA-enabled PyTorch...'
    & $uvPath pip install --python $pythonPath 'torch==2.11.0' --index-url 'https://download.pytorch.org/whl/cu128'
    if ($LASTEXITCODE -ne 0) { throw 'Unable to install CUDA-enabled PyTorch.' }

    Write-Output 'Installing audio download and analysis packages...'
    & $uvPath pip install --python $pythonPath --requirements (Join-Path $workerRoot 'requirements-core.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to install the core audio packages.' }

    Write-Output 'Installing the pinned BS-RoFormer inference engine...'
    if ($roformerArchive -and (Test-Path -LiteralPath $roformerArchive -PathType Leaf)) {
        & $uvPath pip install --python $pythonPath $roformerArchive
    }
    else {
        & $uvPath pip install --python $pythonPath --requirements (Join-Path $workerRoot 'requirements-engine.txt')
    }
    if ($LASTEXITCODE -ne 0) { throw 'Unable to install BS-RoFormer-Infer.' }

    Write-Output 'Verifying the engine and GPU...'
    $env:PYTHONPATH = $workerRoot
    $env:REMIXER_DATA_DIR = $dataPath
    $env:REMIXER_MODELS_DIR = $modelsPath
    & $pythonPath -c "import json; from remixer_worker.health import health; result = health(); print(json.dumps(result, indent=2)); raise SystemExit(0 if result['ready'] else 1)"
    if ($LASTEXITCODE -ne 0) { throw 'The installed audio engine did not pass verification.' }

    Write-Output 'Downloading and verifying the core six-stem model (~700 MB)...'
    & $pythonPath -c "from remixer_worker.separation import prepare_model; prepare_model('full', lambda stage, progress, message: print(message, flush=True))"
    if ($LASTEXITCODE -ne 0) { throw 'Unable to prepare the core six-stem model.' }

    Write-Output 'Removing temporary setup downloads...'
    & $uvPath cache clean
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Remixer is ready, but its temporary setup cache could not be removed.' }
}
finally {
    $env:PATH = $previousPath
    $env:UV_PYTHON_INSTALL_DIR = $previousUvPythonInstallDir
    $env:UV_PYTHON_INSTALL_BIN = $previousUvPythonInstallBin
    $env:UV_CACHE_DIR = $previousUvCacheDir
    $env:PYTHONPATH = $previousPythonPath
    $env:PYTHONUTF8 = $previousPythonUtf8
    $env:PYTHONIOENCODING = $previousPythonIoEncoding
    $env:REMIXER_DATA_DIR = $previousDataPath
    $env:REMIXER_MODELS_DIR = $previousModelsPath
}

Write-Output 'Remixer audio engine, private tools, and core model are ready.'

