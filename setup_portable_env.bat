@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "PYTHON_BOOTSTRAP="
set "PYTHON_BOOTSTRAP_ARGS="
where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_BOOTSTRAP=py"
  set "PYTHON_BOOTSTRAP_ARGS=-3"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=python"
  )
)

if not exist ".venv\Scripts\python.exe" (
  if not defined PYTHON_BOOTSTRAP (
    echo [Error] Python was not found.
    echo Please install Python 3.10 or 3.11 and make sure it is available in PATH.
    pause
    exit /b 1
  )

  echo [Setup] Create virtual environment...
  call "%PYTHON_BOOTSTRAP%" %PYTHON_BOOTSTRAP_ARGS% -m venv .venv
  if errorlevel 1 (
    echo.
    echo [Error] Failed to create .venv.
    pause
    exit /b 1
  )
)

echo [Setup] Upgrade pip...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
  echo.
  echo [Error] Failed to upgrade pip.
  pause
  exit /b 1
)

echo [Setup] Install Python dependencies...
call ".venv\Scripts\pip.exe" install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [Error] Failed to install Python dependencies.
  pause
  exit /b 1
)

echo.
echo Setup finished.
echo Use run_portable_app.bat to start the integrated app.
pause
