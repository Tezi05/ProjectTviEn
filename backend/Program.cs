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
                    if (!await db.Genres.AnyAsync()) {
                        db.Genres.AddRange(new Genre { Name = "Hành Động", Slug = "hanh-dong" }, new Genre { Name = "Viễn Tưởng", Slug = "vien-tuong" });
                    }
                    if (!await db.Persons.AnyAsync())
                    {
                        db.Persons.AddRange(
                            new Person { Id = "christopher-nolan", FullName = "Christopher Nolan", Slug = "christopher-nolan", Gender = 1, Nationality = "Anh" },
                            new Person { Id = "cillian-murphy", FullName = "Cillian Murphy", Slug = "cillian-murphy", Gender = 1, Nationality = "Ireland" }
                        );
                    }
                    if (!await db.Movies.AnyAsync()) {
                        db.Movies.Add(new Movie { Id = "m001", Title = "Interstellar", Slug = "interstellar", ReleaseYear = 2014 });
                    }
                    if (!await db.Users.AnyAsync()) {
                        db.Users.Add(new User { UserId = "u001", GoogleId = "admin_seed", Email = "admin@tvien.com", DisplayName = "Admin", RoleId = 1 });
                    }
                    await db.SaveChangesAsync();
                    return Results.Ok("Seed thành công!");
                } catch (Exception ex) {
                    return Results.BadRequest($"Lỗi Seed: {ex.Message}");
                }
            });

            app.MapControllers();
            app.Run();
        }
    }
}
