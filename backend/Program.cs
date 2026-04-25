using Microsoft.EntityFrameworkCore;
using Prometheus;

using ProjectTviEn.Models;
using ProjectTviEn.Services;

namespace ProjectTviEn
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args });

            // Tắt tính năng tự nạp lại (reload) appsettings để tránh lỗi cạn kiệt inotify trên Docker/Linux
            builder.Host.ConfigureAppConfiguration((hostingContext, config) =>
            {
                foreach (var source in config.Sources.OfType<FileConfigurationSource>())
                {
                    source.ReloadOnChange = false;
                }
            });
            
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            // Add services to the container.
            builder.Services.AddScoped<IR2Service, R2Service>();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll",
                    builder => builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
            });

            // --- REDIS CACHE (Scaling) ---
            // Kết nối vào Docker Redis cổng 6379. 
            // Nếu Redis chưa chạy, hệ thống vẫn hoạt động bình thường (chỉ chậm hơn).
            var redisConnection = (builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379") + ",abortConnect=false";
            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnection;
                options.InstanceName = "tvien:"; // Prefix cho mọi cache key
            });

            // Đăng ký IConnectionMultiplexer để dùng các lệnh Redis nâng cao (như Queue)
            builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(
                StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnection)
            );


            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                });
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
                {
                    Title = "TviEn Streaming API",
                    Version = "v1",
                    Description = "API quản lý phim, upload, transcoding và streaming cho nền tảng TviEn"
                });
            });

            var app = builder.Build();

            // Tự động chạy Migration để tạo bảng trên Supabase (Cloud) nếu chưa có
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Database.Migrate();
            }

            // Swagger luôn hiển thị (kể cả Production)
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "TviEn API v1");
                c.RoutePrefix = string.Empty; // Để rỗng thì truy cập vào trang web cái là thấy Swagger luôn!
                c.DocumentTitle = "TviEn API Docs";
            });

            //app.UseHttpsRedirection();

            app.UseCors("AllowAll");

            app.UseAuthorization();

            // --- BƯỚC MỚI: KÍCH HOẠT PROMETHEUS METRICS ---
            app.UseHttpMetrics(); // Tự động đo lường thời gian phản hồi của các API
            app.MapMetrics();     // Phơi bày cổng /metrics cho Prometheus thu thập

            app.MapControllers();

            app.Run();
        }
    }
}
