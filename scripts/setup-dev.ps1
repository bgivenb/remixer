$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$engineRoot = Join-Path $env:LOCALAPPDATA 'Remixer\engine'
$runtimeRoot = Join-Path $projectRoot 'build-tools\windows-runtime'

& node (Join-Path $PSScriptRoot 'prepare-windows-runtime.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$previousBundledTools = $env:REMIXER_BUNDLED_TOOLS_DIR
try {
    $env:REMIXER_BUNDLED_TOOLS_DIR = $runtimeRoot
    & (Join-Path $PSScriptRoot 'setup-engine.ps1') -InstallRoot $engineRoot
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    $env:REMIXER_BUNDLED_TOOLS_DIR = $previousBundledTools
}

Push-Location $projectRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
