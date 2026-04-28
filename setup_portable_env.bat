@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv" (
  echo [Setup] Create virtual environment...
  python -m venv .venv
)

echo [Setup] Upgrade pip...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip

echo [Setup] Install Python dependencies...
call ".venv\Scripts\pip.exe" install -r requirements.txt

echo.
echo Setup finished.
echo Use run_portable_app.bat to start the integrated app.
pause
