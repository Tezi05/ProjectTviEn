using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class MovieGenre
    {
        [Required]
        public int MovieId { get; set; }

        [JsonIgnore]
        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        public int GenreId { get; set; }

        [ForeignKey("GenreId")]
        public Genre Genre { get; set; } = null!;
    }
}
