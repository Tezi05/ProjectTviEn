using Microsoft.EntityFrameworkCore;

namespace ProjectTviEn.Models
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        // --- Bảng cũ ---
        public DbSet<Movie> Movies { get; set; }
        public DbSet<IngestJob> IngestJobs { get; set; }
        public DbSet<MediaAsset> MediaAssets { get; set; }
        public DbSet<StreamInfo> Streams { get; set; }

        // --- Bảng nội dung mới ---
        public DbSet<Person> Persons { get; set; }
        public DbSet<RoleInfo> RoleInfos { get; set; }
        public DbSet<MovieCrew> MovieCrews { get; set; }
        public DbSet<Genre> Genres { get; set; }
        public DbSet<MovieGenre> MovieGenres { get; set; }
        public DbSet<Episode> Episodes { get; set; }
        public DbSet<Video> Videos { get; set; }

        // --- Bảng người dùng ---
        public DbSet<Role> Roles { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<WatchHistory> WatchHistories { get; set; }
        public DbSet<Watchlist> Watchlists { get; set; }
        public DbSet<Review> Reviews { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Slug của phim là duy nhất
            modelBuilder.Entity<Movie>()
                .HasIndex(m => m.Slug)
                .IsUnique();

            // Slug của Person là duy nhất
            modelBuilder.Entity<Person>()
                .HasIndex(p => p.Slug)
                .IsUnique();

            // Slug và Name của Genre là duy nhất
            modelBuilder.Entity<Genre>()
                .HasIndex(g => g.Slug).IsUnique();
            modelBuilder.Entity<Genre>()
                .HasIndex(g => g.Name).IsUnique();

            // GoogleId và Email của User là duy nhất
            modelBuilder.Entity<User>()
                .HasIndex(u => u.GoogleId).IsUnique();
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email).IsUnique();

            // MovieGenre: Composite Primary Key (MovieId + GenreId)
            modelBuilder.Entity<MovieGenre>()
                .HasKey(mg => new { mg.MovieId, mg.GenreId });

            // Data seed: Roles người dùng
            modelBuilder.Entity<Role>().HasData(
                new Role { RoleId = 1, Name = "Admin" },
                new Role { RoleId = 2, Name = "VIP" },
                new Role { RoleId = 3, Name = "Member" }
            );

            // Data seed: RoleInfo nhân sự phim
            modelBuilder.Entity<RoleInfo>().HasData(
                new RoleInfo { Id = 1, Name = "Đạo diễn" },
                new RoleInfo { Id = 2, Name = "Diễn viên" },
                new RoleInfo { Id = 3, Name = "Biên kịch" }
            );
        }
    }
}
