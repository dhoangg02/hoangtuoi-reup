@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0release\win-unpacked\HoangTuoi-Reup.exe" (
    start "" "%~dp0release\win-unpacked\HoangTuoi-Reup.exe"
    exit /b 0
)

call npm run start:electron
