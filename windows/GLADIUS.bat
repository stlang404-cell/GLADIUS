@echo off
REM GLADIUS one-click launcher for Windows 10/11. No install, no account, no internet needed.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
