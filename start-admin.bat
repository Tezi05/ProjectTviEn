@echo off
cd /d %~dp0
echo =======================================================
echo    Khoi dong TviEn - Che do ADMIN DASHBOARD
echo =======================================================

echo [1/3] Kich hoat Docker...
docker compose up -d
timeout /t 5 >nul

echo [2/3] Bat Backend...
start "TviEn Backend" cmd /k "cd backend && dotnet run"
timeout /t 10 >nul

echo [3/3] Bat Admin Frontend...
start "TviEn Admin" cmd /k "cd admin-frontend && npm run dev"

echo =======================================================
echo [SUCCESS] Chi khoi dong Admin de tap trung quan ly du lieu!
echo =======================================================
pause
