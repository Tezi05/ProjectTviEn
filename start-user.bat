@echo off
cd /d %~dp0
echo =======================================================
echo    Khoi dong TviEn - Che do USER FRONTEND
echo =======================================================

echo [1/3] Kich hoat Docker...
docker compose up -d
timeout /t 5 >nul

echo [2/3] Bat Backend...
start "TviEn Backend" cmd /k "cd backend && dotnet run"
timeout /t 10 >nul

echo [3/3] Bat Worker va User Frontend...
start "TviEn Worker" cmd /k "cd ProjectTviEn.Worker && dotnet run"
start "TviEn User" cmd /k "cd user-frontend && npm run dev -- -p 3001"

echo =======================================================
echo [SUCCESS] Chi khoi dong User Frontend de tiet kiem CPU!
echo =======================================================
pause
