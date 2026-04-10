using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class MovieCrew
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string MovieId { get; set; } = string.Empty;

        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string PersonId { get; set; } = string.Empty;

        [ForeignKey("PersonId")]
        public Person Person { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Role { get; set; } = string.Empty; // "Director", "Actor", "Writer", "Producer"

        [MaxLength(255)]
        public string? CharacterName { get; set; } // Tên nhân vật (dành cho diễn viên)
    }
}
