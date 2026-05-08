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
                var uri = new Uri(rawConn.Replace("postgresql://", "http://").Replace("postgres://", "http://"));
                var userInfo = uri.UserInfo.Split(':');
                var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                var sslMode = query["sslmode"] ?? "require";
                connectionString = $"Host={uri.Host};Port={(uri.Port > 0 ? uri.Port : 5432)};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={Uri.UnescapeDataString(userInfo.Length > 1 ? userInfo[1] : "")};SSL Mode={sslMode};Trust Server Certificate=true";
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

            // ✅ Redis optional: nếu không có Redis (Render free tier) thì bỏ qua, không crash app
            try
            {
                var redisMux = StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnection);
                builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(redisMux);
                Console.WriteLine("[INFO] Redis connected OK.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARN] Redis unavailable ({ex.Message}). Continuing without Redis.");
                // Đăng ký null-object để tránh DI lỗi nếu có controller inject IConnectionMultiplexer
                builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(
                    StackExchange.Redis.ConnectionMultiplexer.Connect("localhost:6379,abortConnect=false,connectTimeout=100")
                );
            }


            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                });

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

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
            app.UseHttpMetrics();
            app.MapMetrics();

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
