using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Genre : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        [Key]
        public int GenreId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // "Action", "Drama"...

        [Required]
        [MaxLength(100)]
        public string Slug { get; set; } = string.Empty; // "action", "drama"...

        // Navigation
        public ICollection<MovieGenre> MovieGenres { get; set; } = new List<MovieGenre>();
    }
}
