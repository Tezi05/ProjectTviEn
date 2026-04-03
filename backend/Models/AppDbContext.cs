using Microsoft.EntityFrameworkCore;

namespace ProjectTviEn.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // Định nghĩa 4 DbSet tương ứng với 4 bảng trong Database
        public DbSet<Movie> Movies { get; set; }
        public DbSet<IngestJob> IngestJobs { get; set; }
        public DbSet<MediaAsset> MediaAssets { get; set; }
        public DbSet<StreamInfo> Streams { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // (Tuỳ chọn) Ở đây dùng Fluent API để giới hạn hoặc cấu hình thêm
            // Ví dụ: Đảm bảo Slug của phim là duy nhất (Unique)
            modelBuilder.Entity<Movie>()
                .HasIndex(m => m.Slug)
                .IsUnique();
        }
    }
}
