@echo off
echo =======================================================
echo     Khoi dong toan bo he thong Tvien Streaming
echo =======================================================

echo [1/3] Bat Backend (.NET 8)...
start "Tvien Backend" cmd /k "cd backend && dotnet run"

echo [2/3] Bat Worker (FFmpeg/AES)...
start "Tvien Worker" cmd /k "cd ProjectTviEn.Worker && dotnet run"

echo [3/3] Bat Admin Frontend (Next.js)...
start "Tvien Admin" cmd /k "cd admin-frontend && npm run dev"

echo =======================================================
echo [SUCCESS] Da goi 3 cua so moi len de chay song song!
echo =======================================================
