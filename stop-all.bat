@echo off
setlocal
echo =======================================================
echo    DANG GIAI PHONG TOAN BO TAI NGUYEN TVIEN...
echo =======================================================

echo [1/5] Dang tat tien trinh theo Port (3000, 3001, 5113)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5113') do taskkill /F /PID %%a >nul 2>&1

echo [2/5] Dang tat tat ca tien trinh Dotnet va Node...
taskkill /F /IM dotnet.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM VBCSCompiler.exe /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq TviEn*" /T /F >nul 2>&1

echo [3/5] Dang dung Docker (Postgres, Redis, Prometheus)...
docker compose down >nul 2>&1

echo [4/5] Dang xoa file tam thoi (bin/obj) de fix loi khoa file...
rmdir /s /q "backend\bin" >nul 2>&1
rmdir /s /q "backend\obj" >nul 2>&1
rmdir /s /q "ProjectTviEn.Worker\bin" >nul 2>&1
rmdir /s /q "ProjectTviEn.Worker\obj" >nul 2>&1

echo =======================================================
echo [SUCCESS] Da giai phong toan bo tai nguyen! 
echo Bay gio ban co the build va chay lai start-all.bat.
echo =======================================================
timeout /t 3
