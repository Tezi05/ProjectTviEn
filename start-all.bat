@echo off
cd /d %~dp0
echo =======================================================
echo    Khoi dong toan bo he thong TviEn Streaming
echo =======================================================

echo [0/4] Kich hoat Docker (Postgres, Redis, Prometheus)...
docker-compose up -d
echo Dang cho Docker khoi dong (5s)...
timeout /t 5 >nul

echo [1/4] Bat Backend (.NET 8)...
start "TviEn Backend" cmd /k "cd backend && dotnet run"

echo Dang cho Backend build va lang nghe port (10s)...
timeout /t 10 >nul

echo [2/4] Bat Worker (FFmpeg/AES)...
start "TviEn Worker" cmd /k "cd ProjectTviEn.Worker && dotnet run"

echo [3/4] Bat Admin Frontend (Next.js)...
start "TviEn Admin" cmd /k "cd admin-frontend && npm run dev"

echo [4/4] Bat User Frontend (Next.js)...
start "TviEn User" cmd /k "cd user-frontend && npm run dev -- -p 3001"

echo =======================================================
echo [SUCCESS] He thong dang duoc khoi dong trong cac cua so rieng biet!
echo =======================================================