@echo off
setlocal
cd /d "%~dp0"

echo [Test Client] Send sample wav file to backend...
echo Please start run_backend_server.bat first.
echo.

python backend\scripts\test_client.py --realtime

echo.
echo Test client finished.
pause
