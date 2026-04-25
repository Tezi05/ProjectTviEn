@echo off
cd /d %~dp0
echo =======================================================
echo     DANG DUNG TOAN BO HE THONG TVIEN STREAMING
echo =======================================================

echo [1/4] Dang dung cac thung chua Docker (Postgres, Redis...)...
docker-compose down

echo [2/4] Dang dong cac ung dung .NET (Backend & Worker)...
taskkill /F /IM dotnet.exe /T >nul 2>&1
taskkill /F /IM ProjectTviEn.exe /T >nul 2>&1
taskkill /F /IM ProjectTviEn.Worker.exe /T >nul 2>&1

echo [3/4] Dang dong giao dien Web (Node.js)...
taskkill /F /IM node.exe /T >nul 2>&1

echo [4/4] Dang dong cac tien trinh xu ly Video (FFmpeg)...
taskkill /F /IM ffmpeg.exe /T >nul 2>&1

echo =======================================================
echo [SUCCESS] Da dung tat ca tien trinh thanh cong!
echo =======================================================
pause
