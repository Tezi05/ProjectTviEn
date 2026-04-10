using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Person
    {
        [Key]
        [MaxLength(50)]
        public string PersonId { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(255)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Slug { get; set; } // "christopher-nolan"

        public string? Biography { get; set; }

        [MaxLength(1000)]
        public string? ProfilePhotoUrl { get; set; }

        public DateOnly? BirthDate { get; set; }

        [MaxLength(100)]
        public string? Nationality { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<MovieCrew> MovieCrews { get; set; } = new List<MovieCrew>();
    }
}
