using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class IngestJob
    {
        [Key]
        [MaxLength(50)]
        public string JobId { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(50)]
        public string MovieId { get; set; } = string.Empty;

        [ForeignKey("MovieId")]
        public Movie? Movie { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "pending"; // pending, queued, processing, done, failed
        
        public int Attempts { get; set; } = 0;
        public int Priority { get; set; } = 1;

        [MaxLength(1000)]
        public string? RawPath { get; set; }
        
        public string? Logs { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? FinishedAt { get; set; }
    }
}
