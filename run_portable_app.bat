@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_BIN=python"
if exist "%~dp0\.venv\Scripts\python.exe" (
  set "PYTHON_BIN=%~dp0\.venv\Scripts\python.exe"
)

echo [Portable] Start integrated teleprompter service...
echo URL: http://127.0.0.1:8000
echo.

"%PYTHON_BIN%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo.
echo Portable app stopped.
pause
