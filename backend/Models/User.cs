using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTviEn.Models
{
    public class User : ISoftDelete
    {
        public bool IsDeleted { get; set; } = false;
        [Key]
        [MaxLength(50)]
        public string UserId { get; set; } = Guid.NewGuid().ToString("N");

        // Google OAuth — Có thể null nếu đăng ký bằng Email/Pass
        [MaxLength(255)]
        public string? GoogleId { get; set; } // "sub" từ Google JWT

        [MaxLength(255)]
        public string? PasswordHash { get; set; }

        // OTP for Forgot Password
        [MaxLength(10)]
        public string? ResetPasswordOtp { get; set; }
        
        public DateTime? ResetPasswordOtpExpiry { get; set; }

        public int FailedOtpAttempts { get; set; } = 0;

        public DateTime? LastForgotPasswordRequest { get; set; }

        [Required]
        [MaxLength(255)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string DisplayName { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? AvatarUrl { get; set; }

        // Role (default = 3: Member)
        public int RoleId { get; set; } = 3;

        [ForeignKey("RoleId")]
        public Role Role { get; set; } = null!;

        public DateTime? VipExpiresAt { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<WatchHistory> WatchHistories { get; set; } = new List<WatchHistory>();
        public ICollection<Watchlist> Watchlists { get; set; } = new List<Watchlist>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }
}
