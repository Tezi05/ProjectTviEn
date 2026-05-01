using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Movie : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? OriginalTitle { get; set; }

        [Required]
        [MaxLength(255)]
        public string Slug { get; set; } = string.Empty;

        public string? Description { get; set; }

        [MaxLength(1000)]
        public string? PosterUrl { get; set; }

        [MaxLength(1000)]
        public string? BackdropUrl { get; set; }

        [MaxLength(1000)]
        public string? TrailerUrl { get; set; }

        public int? ReleaseYear { get; set; }

        public int? Duration { get; set; } // Đơn vị: Phút

        [MaxLength(10)]
        public string? AgeRating { get; set; } // [C18], [13+]...

        public int ViewCount { get; set; } = 0;

        // --- Quản trị & Audit ---
        public int Status { get; set; } = 0; // 0: Nháp, 1: Hiển thị
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation Properties
        public ICollection<MediaAsset> MediaAssets { get; set; } = new List<MediaAsset>();
        public ICollection<IngestJob> IngestJobs { get; set; } = new List<IngestJob>();
        public StreamInfo? Stream { get; set; }
        public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();
        public ICollection<MovieCrew> MovieCrews { get; set; } = new List<MovieCrew>();
        public ICollection<Episode> Episodes { get; set; } = new List<Episode>();
        public ICollection<Video> Videos { get; set; } = new List<Video>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<Watchlist> Watchlists { get; set; } = new List<Watchlist>();

        // Các trường hỗ trợ nhận dữ liệu từ Frontend (Không lưu trực tiếp vào bảng Movies)
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public List<int>? GenreIds { get; set; }
        
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public List<MovieCrewDto>? CrewMembers { get; set; }
    }

    public class MovieCrewDto {
        public string PersonId { get; set; } = string.Empty;
        public int RoleId { get; set; }
    }
}
