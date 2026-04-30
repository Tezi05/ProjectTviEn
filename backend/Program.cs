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

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            builder.Services.AddScoped<IR2Service, R2Service>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll",
                    builder => builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
            });

            var redisConnection = (builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379") + ",abortConnect=false";
            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnection;
                options.InstanceName = "tvien:";
            });

            builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(
                StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnection)
            );

            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
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

            app.UseCors("AllowAll");
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
