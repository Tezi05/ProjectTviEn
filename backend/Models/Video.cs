using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class Video : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        
        [Key]
        public Guid VideoId { get; set; } = Guid.NewGuid();

        // Video thuộc về Movie (phim lẻ) HOẶC Episode (phim bộ)
        public int? MovieId { get; set; }

        [ForeignKey("MovieId")]
        [JsonIgnore]
        public Movie? Movie { get; set; }

        public Guid? EpisodeId { get; set; }

        [ForeignKey("EpisodeId")]
        [JsonIgnore]
        public Episode? Episode { get; set; }

        [Required]
        [MaxLength(50)]
        public string Resolution { get; set; } = string.Empty; // "1080p", "720p", "480p"

        [MaxLength(1000)]
        public string? MasterPlaylistUrl { get; set; } // URL file .m3u8 trên R2

        [MaxLength(1000)]
        public string? SubtitleUrl { get; set; }

        public bool IsEncrypted { get; set; } = false;

        // DRM - AES-128
        [MaxLength(255)]
        public string? EncryptionKey { get; set; }
        
        [MaxLength(255)]
        public string? IV { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
