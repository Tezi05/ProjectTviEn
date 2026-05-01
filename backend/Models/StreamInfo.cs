using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class StreamInfo
    {
        [Key]
        public int MovieId { get; set; }
        
        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        [MaxLength(1000)]
        public string? MasterPlaylist { get; set; }
        
        [MaxLength(1000)]
        public string? CdnUrl { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "preparing"; // preparing, ready, failed
        
        public DateTime? ReadyAt { get; set; }
    }
}
