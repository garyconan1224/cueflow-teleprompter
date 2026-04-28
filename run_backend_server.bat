@echo off
setlocal
cd /d "%~dp0"

echo [Backend] Start FastAPI WebSocket server...
echo HTTP: http://127.0.0.1:8000
echo WS:   ws://127.0.0.1:8000/ws/teleprompter
echo.

python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo.
echo Backend server stopped.
pause
