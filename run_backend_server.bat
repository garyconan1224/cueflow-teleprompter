@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "PYTHON_CMD="
set "PYTHON_ARGS="
if exist "%SCRIPT_DIR%.venv\Scripts\python.exe" (
  call "%SCRIPT_DIR%.venv\Scripts\python.exe" --version >nul 2>nul
  if errorlevel 1 (
    echo [Error] The local .venv is broken or was moved from another computer.
    echo Please run setup_portable_env.bat once to rebuild it.
    pause
    exit /b 1
  )
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

if defined PYTHON_CMD (
  call "%PYTHON_CMD%" %PYTHON_ARGS% --version >nul 2>nul
  if errorlevel 1 (
    set "PYTHON_CMD="
    set "PYTHON_ARGS="
  )
)
if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
    set "PYTHON_ARGS="
    call python --version >nul 2>nul
    if errorlevel 1 (
      set "PYTHON_CMD="
    )
  )
)

if not defined PYTHON_CMD (
  echo [Error] Python was not found.
  echo Please install Python 3.10 or 3.11, or run setup_portable_env.bat first.
  pause
  exit /b 1
)

echo [Backend] Start FastAPI WebSocket server...
echo HTTP: http://127.0.0.1:8000
echo WS:   ws://127.0.0.1:8000/ws/teleprompter
echo.

call "%PYTHON_CMD%" %PYTHON_ARGS% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo.
echo Backend server stopped.
pause
