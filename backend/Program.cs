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
            var builder = WebApplication.CreateBuilder(args);
            
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
            var redisConnection = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisConnection;
                options.InstanceName = "tvien:"; // Prefix cho mọi cache key
            });

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

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
