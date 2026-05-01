using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class MovieCrew
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MovieId { get; set; }

        [JsonIgnore]
        [ForeignKey("MovieId")]
        public Movie Movie { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string PersonId { get; set; } = string.Empty;

        [ForeignKey("PersonId")]
        public Person Person { get; set; } = null!;

        [Required]
        public int RoleId { get; set; }

        [ForeignKey("RoleId")]
        public RoleInfo RoleInfo { get; set; } = null!;

        [MaxLength(255)]
        public string? CharacterName { get; set; } // Tên nhân vật (dành cho diễn viên)
    }
}
