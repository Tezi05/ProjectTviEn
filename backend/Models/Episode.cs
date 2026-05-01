using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class Episode : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        
        [Key]
        public Guid EpisodeId { get; set; } = Guid.NewGuid();

        [Required]
        public int MovieId { get; set; }

        [JsonIgnore]
        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        public int SeasonNumber { get; set; } = 1;

        public int EpisodeNumber { get; set; }

        [MaxLength(255)]
        public string? Title { get; set; }

        public string? Description { get; set; }

        public int? Duration { get; set; } // Đơn vị: giây

        public DateOnly? AirDate { get; set; }

        // --- Quản trị & Audit ---
        public int Status { get; set; } = 0; // 0: Nháp, 1: Hiển thị
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public ICollection<Video> Videos { get; set; } = new List<Video>();
        public ICollection<WatchHistory> WatchHistories { get; set; } = new List<WatchHistory>();
    }
}
