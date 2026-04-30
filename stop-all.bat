@echo off
echo =======================================================
echo    DANG GIAI PHONG TOAN BO TAI NGUYEN TVIEN...
echo =======================================================

echo [1/4] Dang tat Frontend gop (User + Admin)...
taskkill /FI "WINDOWTITLE eq TviEn Frontend*" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a >nul 2>&1

echo [2/4] Dang tat Backend va Worker...
taskkill /FI "WINDOWTITLE eq TviEn Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TviEn Worker*" /T /F >nul 2>&1

echo [3/4] Dang quet sach cac tien trinh chay ngam (Node, Dotnet)...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM dotnet.exe /T >nul 2>&1

echo [4/4] Dang dung Docker (Postgres, Redis, Prometheus)...
docker compose down

echo =======================================================
echo [SUCCESS] Da giai phong toan bo tai nguyen! 
echo May tinh cua ban hien tai da sach se 100%%.
echo =======================================================
timeout /t 3
