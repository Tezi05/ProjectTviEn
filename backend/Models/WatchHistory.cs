using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class WatchHistory
    {
        [Key]
        public int HistoryId { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; } = string.Empty;

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public int? MovieId { get; set; }

        [ForeignKey("MovieId")]
        public Movie? Movie { get; set; }

        public Guid? EpisodeId { get; set; }

        [ForeignKey("EpisodeId")]
        public Episode? Episode { get; set; }

        public int ProgressSeconds { get; set; } = 0; // Đang xem đến giây thứ mấy

        public bool IsCompleted { get; set; } = false;

        public DateTime WatchedAt { get; set; } = DateTime.UtcNow;
    }
}
