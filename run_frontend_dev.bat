@echo off
setlocal
cd /d "%~dp0\frontend"

echo [Frontend] Start web dev server...
echo URL: http://localhost:5173
echo.

npm.cmd run dev

echo.
echo Frontend server stopped.
pause
