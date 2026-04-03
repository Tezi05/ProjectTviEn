using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class MediaAsset
    {
        [Key]
        [MaxLength(50)]
        public string AssetId { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(50)]
        public string MovieId { get; set; }
        
        [ForeignKey("MovieId")]
        public Movie Movie { get; set; }

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } // raw, variant, thumb, subtitle

        [Required]
        [MaxLength(1000)]
        public string Path { get; set; }

        [MaxLength(50)]
        public string? Quality { get; set; }
        
        [MaxLength(255)]
        public string? Checksum { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [MaxLength(100)]
        public string? RetentionPolicy { get; set; }
    }
}
