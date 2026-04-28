@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
set "PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple"
set "PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn"

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

if defined PYTHON_BOOTSTRAP (
  call "%PYTHON_BOOTSTRAP%" %PYTHON_BOOTSTRAP_ARGS% --version >nul 2>nul
  if errorlevel 1 (
    set "PYTHON_BOOTSTRAP="
    set "PYTHON_BOOTSTRAP_ARGS="
  )
)
if not defined PYTHON_BOOTSTRAP (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=python"
    set "PYTHON_BOOTSTRAP_ARGS="
    call python --version >nul 2>nul
    if errorlevel 1 (
      set "PYTHON_BOOTSTRAP="
    )
  )
)

if exist ".venv\Scripts\python.exe" (
  call ".venv\Scripts\python.exe" --version >nul 2>nul
  if errorlevel 1 (
    echo [Setup] Existing .venv is broken or was moved from another computer.
    echo [Setup] Recreate virtual environment...
    rmdir /s /q ".venv"
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
call ".venv\Scripts\python.exe" -m pip install --upgrade pip -i "%PIP_INDEX_URL%" --trusted-host "%PIP_TRUSTED_HOST%" --retries 10 --resume-retries 10 --timeout 120
if errorlevel 1 (
  echo.
  echo [Error] Failed to upgrade pip.
  pause
  exit /b 1
)

echo.
echo Select PyTorch runtime:
echo   1. CPU  - safest fallback, works on any Windows PC
echo   2. GPU  - NVIDIA CUDA 12.1, faster ASR but much larger download
set /p TORCH_MODE=Mode [1/2, default 1]:
set "TORCH_INDEX_URL=https://mirror.sjtu.edu.cn/pytorch-wheels/cpu"
set "TORCH_INSTALL_MODE=--upgrade"
if "%TORCH_MODE%"=="2" set "TORCH_INDEX_URL=https://mirror.sjtu.edu.cn/pytorch-wheels/cu121"
if "%TORCH_MODE%"=="2" set "TORCH_INSTALL_MODE=--force-reinstall"

echo [Setup] Install PyTorch runtime...
call ".venv\Scripts\python.exe" -m pip install %TORCH_INSTALL_MODE% torch torchaudio --index-url "%TORCH_INDEX_URL%" --retries 10 --resume-retries 10 --timeout 120
if errorlevel 1 (
  echo.
  echo [Error] Failed to install PyTorch runtime.
  pause
  exit /b 1
)

echo [Setup] Install Python dependencies...
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt -i "%PIP_INDEX_URL%" --trusted-host "%PIP_TRUSTED_HOST%" --retries 10 --resume-retries 10 --timeout 120
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
