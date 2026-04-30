using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class Episode : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        [Key]
        [MaxLength(50)]
        public string EpisodeId { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(50)]
        public string MovieId { get; set; } = string.Empty;

        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        public int SeasonNumber { get; set; } = 1;

        public int EpisodeNumber { get; set; }

        [MaxLength(255)]
        public string? Title { get; set; }

        public string? Description { get; set; }

        public int? Duration { get; set; } // Đơn vị: giây

        public DateOnly? AirDate { get; set; }

        // Navigation
        public ICollection<Video> Videos { get; set; } = new List<Video>();
        public ICollection<WatchHistory> WatchHistories { get; set; } = new List<WatchHistory>();
    }
}
