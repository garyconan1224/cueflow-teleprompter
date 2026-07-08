@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

rem Double-clicking .bat from Explorer may not inherit the same PATH as a terminal.
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\nodejs"

if not exist "%SCRIPT_DIR%frontend\package.json" (
  echo [Error] frontend\package.json was not found.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js/npm was not found.
  echo Please install Node.js 18+ and make sure npm is available in PATH.
  exit /b 1
)

pushd "%SCRIPT_DIR%frontend"

if not exist "node_modules" (
  echo [Build] Install frontend dependencies...
  call npm.cmd install
  if errorlevel 1 (
    popd
    echo [Error] Failed to install frontend dependencies.
    exit /b 1
  )
)

echo [Build] Build frontend...
call npm.cmd run build
set "BUILD_ERR=%ERRORLEVEL%"
popd

if not "%BUILD_ERR%"=="0" (
  echo [Error] Failed to build frontend.
  exit /b 1
)

if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
  echo [Error] Build finished but frontend\dist\index.html was not found.
  exit /b 1
)

echo [Build] Frontend ready: frontend\dist
exit /b 0
