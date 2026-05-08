using Microsoft.EntityFrameworkCore;
using Prometheus;
using ProjectTviEn.Models;
using ProjectTviEn.Services;

namespace ProjectTviEn
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Tắt reload cấu hình để tối ưu hiệu suất (Sử dụng builder.Configuration trực tiếp)
            foreach (var source in ((IConfigurationBuilder)builder.Configuration).Sources.OfType<FileConfigurationSource>())
            {
                source.ReloadOnChange = false;
            }

            // ✅ Hỗ trợ cả 2 format: key-value (local) và URL (Neon/Render production)
            var rawConn = builder.Configuration.GetConnectionString("DefaultConnection")
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? "";

            // Tự động convert nếu là URL dạng postgresql:// hoặc postgres://
            string connectionString;
            if (rawConn.StartsWith("postgresql://") || rawConn.StartsWith("postgres://"))
            {
                // Parse thủ công để tránh lấy nhầm port 80 khi dùng Uri với http://
                var stripped = rawConn.Replace("postgresql://", "").Replace("postgres://", "");
                var atIdx = stripped.IndexOf('@');
                var userInfo = stripped.Substring(0, atIdx);
                var hostAndRest = stripped.Substring(atIdx + 1);

                var userParts = userInfo.Split(':', 2);
                var username = Uri.UnescapeDataString(userParts[0]);
                var password = userParts.Length > 1 ? Uri.UnescapeDataString(userParts[1]) : "";

                var slashIdx = hostAndRest.IndexOf('/');
                var hostPart = slashIdx >= 0 ? hostAndRest.Substring(0, slashIdx) : hostAndRest;
                var dbAndParams = slashIdx >= 0 ? hostAndRest.Substring(slashIdx + 1) : "";

                // Tách host và port (ầu mặc PostgreSQL là 5432)
                var colonIdx = hostPart.LastIndexOf(':');
                string dbHost; int dbPort;
                if (colonIdx >= 0 && int.TryParse(hostPart.Substring(colonIdx + 1), out dbPort))
                    dbHost = hostPart.Substring(0, colonIdx);
                else { dbHost = hostPart; dbPort = 5432; }

                var qIdx = dbAndParams.IndexOf('?');
                var database = Uri.UnescapeDataString(qIdx >= 0 ? dbAndParams.Substring(0, qIdx) : dbAndParams);
                var queryStr = qIdx >= 0 ? dbAndParams.Substring(qIdx + 1) : "";
                var sslMode = "require";
                foreach (var p in queryStr.Split('&'))
                    if (p.StartsWith("sslmode=")) sslMode = p.Substring(8);

                connectionString = $"Host={dbHost};Port={dbPort};Database={database};Username={username};Password={password};SSL Mode={sslMode};Trust Server Certificate=true";
                Console.WriteLine($"[INFO] DB parsed: Host={dbHost} Port={dbPort} DB={database} SSL={sslMode}");
            }
            else
            {
                connectionString = rawConn;
            }

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(connectionString));


            builder.Services.AddScoped<IR2Service, R2Service>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins(
                        "https://tvien-xxx.vercel.app",  // TODO: Thay bằng URL Vercel thật của bạn
                        "http://localhost:3000",         // User frontend
                        "http://localhost:3001"          // Admin frontend (nếu có)
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
                });
            });

            var redisConnection = (builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379") + ",abortConnect=false,connectTimeout=3000,syncTimeout=3000";
            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnection;
                options.InstanceName = "tvien:";
            });

            // ✅ Redis optional: nếu không có Redis thì dùng lazy connect (abortConnect=false)
            try
            {
                var redisMux = StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnection);
                builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(redisMux);
                Console.WriteLine("[INFO] Redis connected OK.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARN] Redis unavailable ({ex.Message}). Using lazy connection.");
                // Dùng lazy factory - không throw khi chưa kết nối được
                builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(
                    sp => StackExchange.Redis.ConnectionMultiplexer.Connect("localhost:6379,abortConnect=false")
                );
            }


            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                });

            builder.Services.AddEndpointsApiExplorer();
            // ✅ Cấu hình Swagger hỗ trợ IFormFile (multipart/form-data) không bị crash
            builder.Services.AddSwaggerGen(c =>
            {
                c.MapType<IFormFile>(() => new Microsoft.OpenApi.Models.OpenApiSchema
                {
                    Type = "string",
                    Format = "binary"
                });
            });

            var app = builder.Build();

            try 
            {
                using (var scope = app.Services.CreateScope())
                {
                    var services = scope.ServiceProvider;
                    var db = services.GetRequiredService<AppDbContext>();
                    
                    Console.WriteLine("[INFO] Migrating database...");
                    db.Database.Migrate();

                    Console.WriteLine("[INFO] Seeding data...");
                    await ProjectTviEn.Data.DataSeeder.SeedAsync(db);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Startup failed: {ex.Message}");
            }

            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "TviEn API v1");
                c.RoutePrefix = string.Empty;
            });

            app.UseCors("AllowFrontend");
            app.UseAuthorization();
            // ✅ Prometheus metrics - optional, bỏ qua nếu lỗi
            try { app.UseHttpMetrics(); app.MapMetrics(); } catch { Console.WriteLine("[WARN] Prometheus metrics unavailable."); }

            app.MapPost("/api/admin/seed", async (AppDbContext db) =>
            {
                try {
                    // --- 1. Tạo dữ liệu mẫu nếu bảng trống ---
                    await ProjectTviEn.Data.DataSeeder.SeedAsync(db);

                    // --- 2. Sửa lỗi Slug cho các phim cũ đang bị trống ---
                    var moviesToFix = await db.Movies.Where(m => string.IsNullOrEmpty(m.Slug)).ToListAsync();
                    foreach (var m in moviesToFix)
                    {
                        m.Slug = m.Title.ToLower()
                            .Normalize(System.Text.NormalizationForm.FormD)
                            .Replace("đ", "d").Replace("Đ", "d");
                        // Logic đơn giản để fix nhanh trong DB
                        m.Slug = System.Text.RegularExpressions.Regex.Replace(m.Slug, @"[\u0300-\u036f]", "");
                        m.Slug = System.Text.RegularExpressions.Regex.Replace(m.Slug, @"[^a-z0-9\s-]", "");
                        m.Slug = System.Text.RegularExpressions.Regex.Replace(m.Slug, @"\s+", "-").Trim('-');
                    }
                    
                    await db.SaveChangesAsync();
                    return Results.Ok($"Đã cập nhật dữ liệu mẫu và sửa {moviesToFix.Count} phim bị thiếu Slug!");
                } catch (Exception ex) {
                    return Results.BadRequest($"Lỗi: {ex.Message}");
                }
            });

            app.MapControllers();
            app.Run();
        }
    }
}
