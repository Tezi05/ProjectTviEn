using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class RoleInfo
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // "Đạo diễn", "Diễn viên", "Biên kịch"

        // Navigation
        public ICollection<MovieCrew> MovieCrews { get; set; } = new List<MovieCrew>();
    }
}
