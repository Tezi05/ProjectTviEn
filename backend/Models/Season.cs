using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ProjectTviEn.Models
{
    public class Season : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;

        [Key]
        public Guid SeasonId { get; set; } = Guid.NewGuid();

        [Required]
        public int MovieId { get; set; }

        [ForeignKey("MovieId")]
        [JsonIgnore]
        public virtual Movie Movie { get; set; } = null!;

        public int SeasonNumber { get; set; } = 1;

        [MaxLength(255)]
        public string? Name { get; set; }

        public int ReleaseYear { get; set; } = DateTime.UtcNow.Year;

        public string? PlotSynopsis { get; set; }

        public string? PosterUrl { get; set; }

        // --- Quản trị & Audit ---
        public int Status { get; set; } = 0; // 0: Nháp, 1: Hiển thị
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation collection trực thuộc
        public virtual ICollection<Episode> Episodes { get; set; } = new List<Episode>();
    }
}
