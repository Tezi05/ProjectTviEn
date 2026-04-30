using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Person : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        [Key]
        [MaxLength(50)]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(255)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Slug { get; set; } // "christopher-nolan"

        // Ngày sinh (Date)
        public DateOnly? Dob { get; set; }

        // Giới tính (1: Nam, 2: Nữ)
        public byte? Gender { get; set; }

        // Tiểu sử (NVARCHAR(MAX))
        public string? Biography { get; set; }

        // Ảnh đại diện
        [MaxLength(1000)]
        public string? AvatarUrl { get; set; }

        [MaxLength(50)]
        public string? Nationality { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<MovieCrew> MovieCrews { get; set; } = new List<MovieCrew>();
    }
}
