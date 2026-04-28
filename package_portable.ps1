$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $projectRoot "release"
$bundleRoot = Join-Path $releaseRoot "voice_teleprompter_portable"

Write-Host "[1/4] Build frontend..."
Push-Location (Join-Path $projectRoot "frontend")
npm.cmd install
npm.cmd run build
Pop-Location

Write-Host "[2/4] Prepare bundle folder..."
if (Test-Path $bundleRoot) {
  Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleRoot | Out-Null
$bundleFrontend = Join-Path $bundleRoot "frontend"
New-Item -ItemType Directory -Path $bundleFrontend | Out-Null

Write-Host "[3/4] Copy runtime files..."
Copy-Item -LiteralPath (Join-Path $projectRoot "backend") -Destination $bundleRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "frontend\dist") -Destination (Join-Path $bundleFrontend "dist") -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "requirements.txt") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "README.md") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "phase1_asr_test.py") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "run_portable_app.bat") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "setup_portable_env.bat") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "run_phase1_mic_test.bat") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "run_ws_test_client.bat") -Destination $bundleRoot

$modelCache = Join-Path $projectRoot ".modelscope_cache"
if (Test-Path $modelCache) {
  Copy-Item -LiteralPath $modelCache -Destination $bundleRoot -Recurse
}

Write-Host "[4/4] Bundle ready:"
Write-Host $bundleRoot
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Copy the folder to another Windows location or machine."
Write-Host "  2. Run setup_portable_env.bat once."
Write-Host "  3. Run run_portable_app.bat and open http://127.0.0.1:8000"
