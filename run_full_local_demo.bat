@echo off
setlocal
cd /d "%~dp0"

echo [Demo] Start backend in a new window.
start "Teleprompter Backend" cmd /k "cd /d %~dp0 && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo [Demo] Start frontend in a new window.
start "Teleprompter Frontend" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo Backend: http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
echo Run run_ws_test_client.bat if you want the sample wav test.
pause
