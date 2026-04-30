@echo off
echo =======================================================
echo    Dang dung che do USER FRONTEND...
echo =======================================================

echo [1/3] Dang tat User Frontend (Port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a >nul 2>&1

echo [2/3] Dang tat TviEn Worker...
taskkill /FI "WINDOWTITLE eq TviEn Worker*" /T /F >nul 2>&1

echo [3/3] Dang tat TviEn Backend...
taskkill /FI "WINDOWTITLE eq TviEn Backend*" /T /F >nul 2>&1

echo =======================================================
echo [SUCCESS] Da dung cac tien trinh lien quan den User!
echo =======================================================
timeout /t 2 >nul
