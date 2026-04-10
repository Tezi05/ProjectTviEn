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
}
