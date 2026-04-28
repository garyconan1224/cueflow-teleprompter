@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "PYTHON_CMD="
set "PYTHON_ARGS="
if exist "%SCRIPT_DIR%.venv\Scripts\python.exe" (
  set "PYTHON_CMD=%SCRIPT_DIR%.venv\Scripts\python.exe"
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=py"
    set "PYTHON_ARGS=-3"
  ) else (
    where python >nul 2>nul
    if not errorlevel 1 (
      set "PYTHON_CMD=python"
    )
  )
)

if not defined PYTHON_CMD (
  echo [Error] Python was not found.
  echo Please install Python or run setup_portable_env.bat first.
  pause
  exit /b 1
)

echo [Test Client] Send sample wav file to backend...
echo Please start run_backend_server.bat first.
echo.

call "%PYTHON_CMD%" %PYTHON_ARGS% backend\scripts\test_client.py --realtime

echo.
echo Test client finished.
pause
