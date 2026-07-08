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
  echo Please run setup_portable_env.bat first.
  pause
  exit /b 1
)

if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
  echo [Portable] Frontend build not found. Building now...
  call "%SCRIPT_DIR%build_frontend.bat"
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

set "PORT_IN_USE="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  set "PORT_IN_USE=1"
  set "PORT_PID=%%a"
)
if defined PORT_IN_USE (
  echo [Error] Port 8000 is already in use ^(PID %PORT_PID%^).
  echo If you already started this app, open: http://127.0.0.1:8000
  echo Otherwise close the other program using port 8000 and try again.
  pause
  exit /b 1
)

if not exist "%SCRIPT_DIR%.modelscope_cache\models\iic--speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online\snapshots\master\model.pt" (
  if not exist "%SCRIPT_DIR%.modelscope_cache\models\iic\speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online\model.pt" (
    echo [Portable] First start will download the speech model ^(about 900MB^).
    echo Please keep this window open and wait until the service is ready.
    echo.
  )
)

echo [Portable] Start integrated teleprompter service...
echo URL: http://127.0.0.1:8000
echo.

call "%PYTHON_CMD%" %PYTHON_ARGS% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
set "UVICORN_ERR=%ERRORLEVEL%"

if not "%UVICORN_ERR%"=="0" (
  echo.
  echo [Error] Service failed to start.
  echo Common causes:
  echo   1. Port 8000 is already in use
  echo   2. Python dependencies are missing - run setup_portable_env.bat
  echo   3. Speech model download failed - check network and retry
)

echo.
echo Portable app stopped.
pause
exit /b %UVICORN_ERR%
