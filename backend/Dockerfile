# Bước 1: Build Image
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy project và tiến hành restore NuGet
COPY ["ProjectTviEn.csproj", "./"]
RUN dotnet restore "./ProjectTviEn.csproj"

# Copy TOÀN BỘ code backend và tiến hành build
COPY . .
RUN dotnet publish "ProjectTviEn.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Bước 2: Tạo Runtime Image để chạy API Cực Nhẹ
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Thiết lập cửa ngõ cổng 8080 (Mặc định Render đọc cổng này)
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Chạy ứng dụng !!
ENTRYPOINT ["dotnet", "ProjectTviEn.dll"]
