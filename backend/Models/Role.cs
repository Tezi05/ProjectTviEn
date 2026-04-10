using System.ComponentModel.DataAnnotations;

namespace ProjectTviEn.Models
{
    public class Role
    {
        [Key]
        public int RoleId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty; // "Admin", "VIP", "Member"

        // Navigation
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
