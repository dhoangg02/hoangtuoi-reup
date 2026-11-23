@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================================
echo   HOANGTUOI REUP - CAI DAT TAI NGUYEN LOCAL & AI MODELS
echo ========================================================
echo.

echo [1/4] Kiem tra va cai dat thu vien Node.js...
call npm install

echo.
echo [2/4] Cai dat va nang cap thu vien AI Python (Faster-Whisper, Edge-TTS 7.3.1, yt-dlp, FastAPI)...
python -m pip install --upgrade pip
python -m pip install --upgrade -r backend\requirements.txt

echo.
echo [3/4] Kiem tra FFmpeg va tai san Model AI Faster-Whisper (tiny + base)...
where ffmpeg >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Dang cai dat FFmpeg qua winget...
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
)
python -c "from faster_whisper import WhisperModel; print('Dang tai model Whisper tiny...'); WhisperModel('tiny', device='cpu', compute_type='int8'); print('Hoan tat tai model Whisper!')"

echo.
echo [4/4] Build giao dien Studio...
call npm run build

echo.
echo ========================================================
echo   HOAN TAT! Bam phim bat ky de khoi dong HoangTuoi Reup
echo ========================================================
pause >nul
call "%~dp0Start-HoangTuoi-Reup.cmd"
