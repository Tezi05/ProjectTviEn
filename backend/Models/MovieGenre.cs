using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class MovieGenre
    {
        [Required]
        [MaxLength(50)]
        public string MovieId { get; set; } = string.Empty;

        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        public int GenreId { get; set; }

        [ForeignKey("GenreId")]
        public Genre Genre { get; set; } = null!;
    }
}
