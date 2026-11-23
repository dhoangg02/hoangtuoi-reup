@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if exist "%~dp0release\win-unpacked\HoangTuoi-Reup.exe" (
    start "" "%~dp0release\win-unpacked\HoangTuoi-Reup.exe"
    exit /b 0
)

if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
    exit /b 0
)

call npm run start:electron
