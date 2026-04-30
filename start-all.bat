@echo off
cd /d %~dp0
echo =======================================================
echo    DANG KHOI DONG TVIEN (CHE DO GOP - SIEU NHE)
echo =======================================================

echo [1/3] Kich hoat Docker...
docker compose up -d
timeout /t 5 >nul

echo [2/3] Bat Backend...
start "TviEn Backend" cmd /k "cd backend && dotnet run"
echo Doi 10 giay de Backend khoi dong hoan toan...
timeout /t 10 /nobreak
echo Bat Worker...
start "TviEn Worker" cmd /k "cd ProjectTviEn.Worker && dotnet run"
timeout /t 5 /nobreak

echo [3/3] Bat Single Frontend (User + Admin)...
echo Truy cap: http://localhost:3001 (User)
echo Truy cap: http://localhost:3001/admin (Admin)
start "TviEn Frontend" cmd /k "cd user-frontend && npm run dev -- -p 3001"

echo =======================================================
echo [SUCCESS] He thong da chay! Ban chi ton 1 instance Node.js.
echo =======================================================
pause