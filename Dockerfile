# ============================================================
# Dockerfile - đặt ở ROOT của repository cho Render.com
# Build context: thư mục gốc của toàn bộ project
# ============================================================

# Bước 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file trước để tận dụng Docker layer cache
COPY ["backend/ProjectTviEn.csproj", "backend/"]
RUN dotnet restore "backend/ProjectTviEn.csproj"

# Copy toàn bộ source code backend
COPY backend/ backend/

# Build & Publish release
RUN dotnet publish "backend/ProjectTviEn.csproj" -c Release -o /app/publish /p:UseAppHost=false

# -------------------------------------------------------
# Bước 2: Runtime Image nhẹ (không cần SDK)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# Render mặc định lắng nghe cổng 8080
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "ProjectTviEn.dll"]
