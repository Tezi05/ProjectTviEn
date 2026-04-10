using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class Video
    {
        [Key]
        [MaxLength(50)]
        public string VideoId { get; set; } = Guid.NewGuid().ToString("N");

        // Video thuộc về Movie (phim lẻ) HOẶC Episode (phim bộ)
        [MaxLength(50)]
        public string? MovieId { get; set; }

        [ForeignKey("MovieId")]
        public Movie? Movie { get; set; }

        [MaxLength(50)]
        public string? EpisodeId { get; set; }

        [ForeignKey("EpisodeId")]
        public Episode? Episode { get; set; }

        [Required]
        [MaxLength(50)]
        public string Resolution { get; set; } = string.Empty; // "1080p", "720p", "480p"

        [MaxLength(1000)]
        public string? MasterPlaylistUrl { get; set; } // URL file .m3u8 trên R2

        [MaxLength(1000)]
        public string? SubtitleUrl { get; set; }

        public bool IsEncrypted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
