using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Movie
    {
        [Key]
        [MaxLength(50)]
        [JsonPropertyName("movieId")]
        public string Id { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Slug { get; set; } = string.Empty;

        public string? Description { get; set; }

        [MaxLength(1000)]
        public string? PosterUrl { get; set; }

        public int? Duration { get; set; } // Giây

        // --- Thông tin bổ sung ---
        public int? ReleaseYear { get; set; }

        [MaxLength(100)]
        public string? Country { get; set; } // "USA", "Vietnam"...

        [MaxLength(50)]
        public string? Language { get; set; } // "en", "vi"...

        [MaxLength(1000)]
        public string? TrailerUrl { get; set; }

        [MaxLength(20)]
        public string MovieType { get; set; } = "movie"; // "movie" hoặc "series"

        public float? ImdbScore { get; set; } // 0.0 - 10.0

        public int? RottenTomatoesScore { get; set; } // 0 - 100 (%)

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // --- Hệ thống theo dõi lượt xem (Trending) ---
        public int WeeklyViews { get; set; } = 0;
        public int WeeklyViewsResetWeek { get; set; } = 0;

        // AES-128 Encryption Key — không bao giờ trả về Frontend
        public string? EncryptionKey { get; set; }

        // Navigation Properties (cũ)
        public ICollection<MediaAsset> MediaAssets { get; set; } = new List<MediaAsset>();
        public ICollection<IngestJob> IngestJobs { get; set; } = new List<IngestJob>();
        public StreamInfo? Stream { get; set; }

        // Navigation Properties (mới)
        public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();
        public ICollection<MovieCrew> MovieCrews { get; set; } = new List<MovieCrew>();
        public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
        public ICollection<Video> Videos { get; set; } = new List<Video>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<Watchlist> Watchlists { get; set; } = new List<Watchlist>();
    }
}
