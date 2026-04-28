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
  echo Please run setup_portable_env.bat first.
  pause
  exit /b 1
)

if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
  echo [Error] Built frontend files were not found in frontend\dist.
  echo Please rebuild the frontend or recreate the portable package.
  pause
  exit /b 1
)

echo [Portable] Start integrated teleprompter service...
echo URL: http://127.0.0.1:8000
echo.

call "%PYTHON_CMD%" %PYTHON_ARGS% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo.
echo Portable app stopped.
pause
