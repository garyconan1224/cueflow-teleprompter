@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"

if not exist "%FRONTEND_DIR%\package.json" (
  echo [Error] Frontend directory was not found next to this script.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [Error] npm was not found.
  echo Please install Node.js before running the frontend development server.
  pause
  exit /b 1
)

cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
  echo [Frontend] node_modules not found. Installing dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [Error] npm install failed.
    pause
    exit /b 1
  )
)

echo [Frontend] Start web dev server...
echo URL: http://localhost:5173
echo.

call npm.cmd run dev

echo.
echo Frontend server stopped.
pause
