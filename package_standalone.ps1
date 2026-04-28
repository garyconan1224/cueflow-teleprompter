param(
  [switch]$RefreshRuntime
)

$ErrorActionPreference = "Stop"

$pythonVersion = "3.11.9"
$pythonZipName = "python-$pythonVersion-embed-amd64.zip"
$pythonUrl = "https://www.python.org/ftp/python/$pythonVersion/$pythonZipName"
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $projectRoot "release"
$downloadRoot = Join-Path $releaseRoot "_downloads"
$runtimeCacheRoot = Join-Path $releaseRoot "_runtime_cache"
$pythonCacheRoot = Join-Path $runtimeCacheRoot "python-$pythonVersion"
$bundleName = "cueflow-teleprompter-standalone"
$bundleRoot = Join-Path $releaseRoot $bundleName
$zipPath = Join-Path $releaseRoot "$bundleName.zip"

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

function Enable-EmbeddedPythonSite {
  param([string]$PythonRoot)

  $pthPath = Join-Path $PythonRoot "python311._pth"
  if (-not (Test-Path $pthPath)) {
    throw "Cannot find python311._pth in $PythonRoot"
  }

  $lines = Get-Content -LiteralPath $pthPath
  $normalized = New-Object System.Collections.Generic.List[string]
  $hasSitePackages = $false
  $hasImportSite = $false

  foreach ($line in $lines) {
    if ($line.Trim() -eq "Lib\site-packages") {
      $hasSitePackages = $true
    }

    if ($line.TrimStart("#").Trim() -eq "import site") {
      $normalized.Add("import site")
      $hasImportSite = $true
    } else {
      $normalized.Add($line)
    }
  }

  if (-not $hasSitePackages) {
    $normalized.Insert([Math]::Max(0, $normalized.Count - 1), "Lib\site-packages")
  }

  if (-not $hasImportSite) {
    $normalized.Add("import site")
  }

  Set-Content -LiteralPath $pthPath -Value $normalized -Encoding ASCII
}

function Add-BundleAppPath {
  param([string]$PythonRoot)

  $pthPath = Join-Path $PythonRoot "python311._pth"
  if (-not (Test-Path $pthPath)) {
    throw "Cannot find python311._pth in $PythonRoot"
  }

  $lines = Get-Content -LiteralPath $pthPath
  if ($lines -notcontains "..\..") {
    $updated = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
      if ($line.Trim() -eq "import site") {
        $updated.Add("..\..")
      }
      $updated.Add($line)
    }
    Set-Content -LiteralPath $pthPath -Value $updated -Encoding ASCII
  }
}

function Initialize-PythonRuntime {
  if ($RefreshRuntime -and (Test-Path $pythonCacheRoot)) {
    Remove-Item -LiteralPath $pythonCacheRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $runtimeCacheRoot | Out-Null

  $pythonExe = Join-Path $pythonCacheRoot "python.exe"
  if (-not (Test-Path $pythonExe)) {
    $pythonZip = Join-Path $downloadRoot $pythonZipName
    if (-not (Test-Path $pythonZip)) {
      Write-Host "[Runtime] Download Python $pythonVersion..."
      Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip
    }

    Write-Host "[Runtime] Extract Python..."
    New-Item -ItemType Directory -Force -Path $pythonCacheRoot | Out-Null
    Expand-Archive -LiteralPath $pythonZip -DestinationPath $pythonCacheRoot -Force
    Enable-EmbeddedPythonSite -PythonRoot $pythonCacheRoot

    $getPip = Join-Path $downloadRoot "get-pip.py"
    if (-not (Test-Path $getPip)) {
      Write-Host "[Runtime] Download pip bootstrap..."
      Invoke-WebRequest -Uri $getPipUrl -OutFile $getPip
    }

    Write-Host "[Runtime] Install pip..."
    Invoke-Checked $pythonExe @($getPip, "--no-warn-script-location")
  } else {
    Enable-EmbeddedPythonSite -PythonRoot $pythonCacheRoot
  }

  Write-Host "[Runtime] Install Python dependencies into embedded runtime..."
  Invoke-Checked $pythonExe @("-m", "pip", "install", "--upgrade", "pip", "--no-warn-script-location")
  Invoke-Checked $pythonExe @("-m", "pip", "install", "--upgrade", "torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cpu", "--no-warn-script-location")
  Invoke-Checked $pythonExe @("-m", "pip", "install", "--upgrade", "-r", (Join-Path $projectRoot "requirements.txt"), "--no-warn-script-location")
}

function New-StartScript {
  param([string]$TargetPath)

  $content = @(
    "@echo off",
    "setlocal",
    "set ""APP_DIR=%~dp0""",
    "cd /d ""%APP_DIR%""",
    "set ""PYTHONUTF8=1""",
    "set ""MODELSCOPE_CACHE=%APP_DIR%.modelscope_cache""",
    "set ""HF_HOME=%APP_DIR%.modelscope_cache\hf""",
    "set ""PATH=%APP_DIR%runtime\python;%APP_DIR%runtime\python\Scripts;%PATH%""",
    "",
    "if not exist ""%APP_DIR%runtime\python\python.exe"" (",
    "  echo [Error] Embedded Python runtime was not found.",
    "  echo Please rebuild the standalone package.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "if not exist ""%APP_DIR%frontend\dist\index.html"" (",
    "  echo [Error] Built frontend files were not found.",
    "  echo Please rebuild the standalone package.",
    "  pause",
    "  exit /b 1",
    ")",
    "",
    "echo [CueFlow] Starting...",
    "echo URL: http://127.0.0.1:8000",
    "echo.",
    "start """" ""http://127.0.0.1:8000""",
    """%APP_DIR%runtime\python\python.exe"" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000",
    "",
    "echo.",
    "echo CueFlow stopped.",
    "pause"
  )

  Set-Content -LiteralPath $TargetPath -Value $content -Encoding ASCII
}

Write-Host "[1/5] Build frontend..."
Push-Location (Join-Path $projectRoot "frontend")
Invoke-Checked "npm.cmd" @("install")
Invoke-Checked "npm.cmd" @("run", "build")
Pop-Location

Write-Host "[2/5] Prepare embedded Python runtime..."
Initialize-PythonRuntime

Write-Host "[3/5] Prepare standalone bundle..."
if (Test-Path $bundleRoot) {
  Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $bundleRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $bundleRoot "frontend") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $bundleRoot "runtime") | Out-Null

Write-Host "[4/5] Copy application files..."
Copy-Item -LiteralPath (Join-Path $projectRoot "backend") -Destination $bundleRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "frontend\dist") -Destination (Join-Path $bundleRoot "frontend\dist") -Recurse
Copy-Item -LiteralPath $pythonCacheRoot -Destination (Join-Path $bundleRoot "runtime\python") -Recurse
Add-BundleAppPath -PythonRoot (Join-Path $bundleRoot "runtime\python")
Copy-Item -LiteralPath (Join-Path $projectRoot "requirements.txt") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "README.md") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "LICENSE") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "TRANSFER_TO_NEW_PC.md") -Destination $bundleRoot

$modelCache = Join-Path $projectRoot ".modelscope_cache"
if (Test-Path $modelCache) {
  Copy-Item -LiteralPath $modelCache -Destination $bundleRoot -Recurse
}

New-StartScript -TargetPath (Join-Path $bundleRoot "start_cueflow.bat")

Get-ChildItem -Path $bundleRoot -Recurse -Directory -Filter "__pycache__" |
  Remove-Item -Recurse -Force
Get-ChildItem -Path $bundleRoot -Recurse -File -Include "*.pyc","*.pyo" |
  Remove-Item -Force

Write-Host "[5/5] Create zip archive..."
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath

Write-Host "Standalone folder:"
Write-Host $bundleRoot
Write-Host "Standalone zip:"
Write-Host $zipPath
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Copy cueflow-teleprompter-standalone.zip to a clean Windows PC."
Write-Host "  2. Extract it."
Write-Host "  3. Double-click start_cueflow.bat."
