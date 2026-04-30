@echo off
echo =======================================================
echo    Dang dung che do ADMIN DASHBOARD...
echo =======================================================

echo [1/2] Dang tat Admin Frontend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1

echo [2/2] Dang tat TviEn Backend...
taskkill /FI "WINDOWTITLE eq TviEn Backend*" /T /F >nul 2>&1

echo =======================================================
echo [SUCCESS] Da dung cac tien trinh lien quan den Admin!
echo =======================================================
timeout /t 2 >nul
