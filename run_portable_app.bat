@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
set "PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple"
set "PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn"

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

echo Select runtime mode:
echo   1. Auto  - use GPU if available
echo   2. GPU   - force NVIDIA CUDA
echo   3. CPU   - force CPU fallback
set /p CUEFLOW_MODE=Mode [1/2/3, default 1]:
if "%CUEFLOW_MODE%"=="2" set "TELEPROMPTER_DEVICE=cuda:0"
if "%CUEFLOW_MODE%"=="3" set "TELEPROMPTER_DEVICE=cpu"
if not defined TELEPROMPTER_DEVICE set "TELEPROMPTER_DEVICE=auto"

echo [Portable] Start integrated teleprompter service...
echo Runtime: %TELEPROMPTER_DEVICE%
echo URL: http://127.0.0.1:8000
echo.

call "%PYTHON_CMD%" %PYTHON_ARGS% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo.
echo Portable app stopped.
pause
