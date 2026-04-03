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
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        
        [Required]
        [MaxLength(255)]
        public string Title { get; set; }
        
        [Required]
        [MaxLength(255)]
        public string Slug { get; set; }
        
        public string? Description { get; set; }
        
        [MaxLength(1000)]
        public string? PosterUrl { get; set; }
        
        public int? Duration { get; set; } // Giây
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // AES-128 Encryption Key (Base64 encoded, 16 bytes)
        // Không bao giờ trả trực tiếp về Frontend, chỉ đọc bởi Key API nội bộ
        public string? EncryptionKey { get; set; }

        // Navigation Properties
        public ICollection<MediaAsset> MediaAssets { get; set; } = new List<MediaAsset>();
        public ICollection<IngestJob> IngestJobs { get; set; } = new List<IngestJob>();
        public StreamInfo? Stream { get; set; }
    }
}
