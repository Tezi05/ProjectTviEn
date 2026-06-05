using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Google.Apis.Auth;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ProjectTviEn.Controllers.Public
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public AuthController(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        /// <summary>
        /// Đổi Google ID Token lấy JWT của hệ thống.
        /// Client gửi: { "idToken": "..." }
        /// </summary>
        [HttpPost("google")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest req)
        {
            GoogleJsonWebSignature.Payload payload;
            try
            {
                // Bước 1: Xác thực Google ID Token
                payload = await GoogleJsonWebSignature.ValidateAsync(req.IdToken);
            }
            catch
            {
                return Unauthorized("Invalid Google token");
            }

            // Bước 2: Tìm user trong DB hoặc tạo mới (auto-register)
            var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject);
            if (user == null)
            {
                user = new User
                {
                    GoogleId    = payload.Subject,
                    Email       = payload.Email,
                    DisplayName = payload.Name,
                    AvatarUrl   = payload.Picture,
                    RoleId      = 3, // Member mặc định
                    CreatedAt   = DateTime.UtcNow
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync();
            }

            if (!user.IsActive)
                return StatusCode(403, "Tài khoản của bạn đã bị khóa");

            // Bước 3: Tạo JWT của hệ thống
            var jwt = GenerateJwt(user);

            return Ok(new {
                Token       = jwt,
                UserId      = user.UserId,
                DisplayName = user.DisplayName,
                AvatarUrl   = user.AvatarUrl,
                RoleId      = user.RoleId
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { error = "Email và mật khẩu không được để trống." });

            // Kiểm tra xem Email đã tồn tại chưa (kể cả do Google Login tạo ra hay đăng ký bằng Email)
            if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            {
                return BadRequest(new { error = "Email đã được sử dụng." });
            }

            var user = new User
            {
                Email = req.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? req.Email.Split('@')[0] : req.DisplayName,
                RoleId = 3, // Member mặc định
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var jwt = GenerateJwt(user);
            return Ok(new {
                Token = jwt,
                UserId = user.UserId,
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                RoleId = user.RoleId
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
            
            if (user == null || string.IsNullOrEmpty(user.PasswordHash))
            {
                // Nếu user có tồn tại nhưng PasswordHash rỗng -> tức là tài khoản này tạo qua Google Login, không có mật khẩu.
                return Unauthorized(new { error = "Email hoặc mật khẩu không chính xác. Hoặc tài khoản này được tạo bằng Google." });
            }

            if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            {
                return Unauthorized(new { error = "Email hoặc mật khẩu không chính xác." });
            }

            if (!user.IsActive)
                return StatusCode(403, new { error = "Tài khoản của bạn đã bị khóa" });

            var jwt = GenerateJwt(user);
            return Ok(new {
                Token = jwt,
                UserId = user.UserId,
                DisplayName = user.DisplayName,
                AvatarUrl = user.AvatarUrl,
                RoleId = user.RoleId
            });
        }

        private string GenerateJwt(User user)
        {
            var jwtKey = _config["Jwt:Key"] ?? "default-secret-key-at-least-32-chars!!";
            var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim("uid",   user.UserId),
                new Claim("email", user.Email),
                new Claim("role",  user.RoleId.ToString()),
            };

            var token = new JwtSecurityToken(
                issuer:   "tvien",
                audience: "tvien",
                claims:   claims,
                expires:  DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public class GoogleLoginRequest
    {
        public string IdToken { get; set; } = string.Empty;
    }

    public class RegisterRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
