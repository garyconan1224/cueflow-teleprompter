@echo off
setlocal
cd /d "%~dp0"

echo [Phase 1] Start microphone ASR test...
python phase1_asr_test.py

echo.
echo Phase 1 test finished.
pause
