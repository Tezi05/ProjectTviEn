using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using ProjectTviEn.Services;
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
        private readonly IEmailService _emailService;

        public AuthController(AppDbContext db, IConfiguration config, IEmailService emailService)
        {
            _db = db;
            _config = config;
            _emailService = emailService;
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
            catch (Exception ex)
            {
                return Unauthorized(new { error = "Token Google không hợp lệ hoặc đã hết hạn." });
            }

            try
            {
                // Bước 2: Tìm user trong DB theo GoogleId hoặc Email
                var user = await _db.Users.FirstOrDefaultAsync(u => u.GoogleId == payload.Subject || (!string.IsNullOrEmpty(payload.Email) && u.Email == payload.Email));
                
                if (user == null)
                {
                    user = new User
                    {
                        GoogleId    = payload.Subject,
                        Email       = payload.Email ?? "",
                        DisplayName = string.IsNullOrEmpty(payload.Name) ? (payload.Email?.Split('@')[0] ?? "Google User") : payload.Name,
                        AvatarUrl   = payload.Picture,
                        RoleId      = 3, // Member mặc định
                        CreatedAt   = DateTime.UtcNow
                    };
                    _db.Users.Add(user);
                    await _db.SaveChangesAsync();
                }
                else
                {
                    bool isModified = false;

                    // Auto-link: Nếu tài khoản tồn tại qua đăng ký Email truyền thống, giờ link thêm GoogleId
                    if (string.IsNullOrEmpty(user.GoogleId) && !string.IsNullOrEmpty(payload.Email) && user.Email == payload.Email)
                    {
                        user.GoogleId = payload.Subject;
                        isModified = true;
                    }

                    // Tự động lấy Avatar từ Google nếu tài khoản hiện tại chưa có ảnh
                    if (string.IsNullOrEmpty(user.AvatarUrl) && !string.IsNullOrEmpty(payload.Picture))
                    {
                        user.AvatarUrl = payload.Picture;
                        isModified = true;
                    }

                    if (isModified)
                    {
                        await _db.SaveChangesAsync();
                    }
                }

                if (!user.IsActive)
                    return StatusCode(403, new { error = "Tài khoản của bạn đã bị khóa" });

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
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    error = "Lỗi máy chủ khi xử lý tài khoản Google.", 
                    details = ex.InnerException?.Message ?? ex.Message 
                });
            }
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

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email))
                return BadRequest(new { error = "Email không được để trống." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
            
            // Dù user có tồn tại hay không, luôn trả về cùng 1 message (Chống Account Enumeration)
            var genericSuccessMessage = "Nếu email của bạn tồn tại trong hệ thống, mã OTP đã được gửi đến hộp thư của bạn.";

            if (user == null)
            {
                // Giả vờ thành công (để tránh bị dò email)
                return Ok(new { message = genericSuccessMessage });
            }

            // Rate Limiting: 1 request / 60 seconds
            if (user.LastForgotPasswordRequest.HasValue && (DateTime.UtcNow - user.LastForgotPasswordRequest.Value).TotalSeconds < 60)
            {
                // Thậm chí ở đây cũng nên trả Ok hoặc 429 Too Many Requests. 
                // Theo chuẩn bảo mật nếu trả 429 thì có thể rò rỉ việc email có tồn tại hay ko.
                // An toàn nhất: Vẫn trả OK để đánh lừa kẻ tấn công. (Nhưng thực chất ko gửi mail)
                return Ok(new { message = genericSuccessMessage });
            }

            // Generate Cryptographically Secure OTP
            string otp = GenerateSecureOtp(6);

            user.ResetPasswordOtp = otp;
            user.ResetPasswordOtpExpiry = DateTime.UtcNow.AddMinutes(10);
            user.FailedOtpAttempts = 0; // Reset số lần nhập sai
            user.LastForgotPasswordRequest = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            // Gửi email
            var subject = "Yêu cầu đặt lại mật khẩu TviEn";
            var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;'>
                    <h2 style='color: #2c3e50; text-align: center;'>TviEn - Đặt lại mật khẩu</h2>
                    <p>Chào bạn,</p>
                    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.</p>
                    <p>Dưới đây là mã xác thực (OTP) của bạn. Mã này có hiệu lực trong vòng <strong>10 phút</strong>:</p>
                    <div style='text-align: center; margin: 20px 0;'>
                        <span style='display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #e74c3c; background-color: #f9f9f9; padding: 10px 20px; border-radius: 5px; border: 1px dashed #ccc;'>{otp}</span>
                    </div>
                    <p style='color: #7f8c8d; font-size: 14px;'>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
                    <hr style='border: 0; border-top: 1px solid #eee; margin: 20px 0;'>
                    <p style='text-align: center; font-size: 12px; color: #aaa;'>&copy; {DateTime.UtcNow.Year} TviEn. All rights reserved.</p>
                </div>
            ";

            // Có thể chạy ngầm để không block API
            _ = _emailService.SendEmailAsync(user.Email, subject, body);

            return Ok(new { message = genericSuccessMessage });
        }

        [HttpPost("verify-otp")]
        public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Otp))
                return BadRequest(new { error = "Vui lòng cung cấp đầy đủ Email và Mã xác thực." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

            if (user == null || string.IsNullOrEmpty(user.ResetPasswordOtp) || !user.ResetPasswordOtpExpiry.HasValue)
            {
                return BadRequest(new { error = "Yêu cầu không hợp lệ. Vui lòng yêu cầu cấp lại mã OTP." });
            }

            // Kiểm tra OTP hết hạn
            if (DateTime.UtcNow > user.ResetPasswordOtpExpiry.Value)
            {
                return BadRequest(new { error = "Mã OTP đã hết hạn. Vui lòng yêu cầu cấp lại mã mới." });
            }

            // Kiểm tra mã OTP
            if (user.ResetPasswordOtp != req.Otp)
            {
                user.FailedOtpAttempts++;
                if (user.FailedOtpAttempts >= 5)
                {
                    // Quá số lần cho phép -> Hủy mã
                    user.ResetPasswordOtp = null;
                    user.ResetPasswordOtpExpiry = null;
                    user.FailedOtpAttempts = 0;
                    await _db.SaveChangesAsync();
                    return BadRequest(new { error = "Bạn đã nhập sai mã xác thực quá nhiều lần. Mã đã bị hủy, vui lòng yêu cầu cấp lại mã mới." });
                }
                
                await _db.SaveChangesAsync();
                return BadRequest(new { error = "Mã xác thực không chính xác." });
            }

            // Nếu đúng, trả về 200 OK (nhưng KHÔNG xóa OTP để bước ResetPassword còn dùng)
            return Ok(new { message = "Mã xác thực hợp lệ." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Otp) || string.IsNullOrWhiteSpace(req.NewPassword))
                return BadRequest(new { error = "Vui lòng cung cấp đầy đủ Email, Mã xác thực và Mật khẩu mới." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);

            if (user == null || string.IsNullOrEmpty(user.ResetPasswordOtp) || !user.ResetPasswordOtpExpiry.HasValue)
            {
                return BadRequest(new { error = "Yêu cầu không hợp lệ. Vui lòng yêu cầu cấp lại mã OTP." });
            }

            // Kiểm tra OTP hết hạn
            if (DateTime.UtcNow > user.ResetPasswordOtpExpiry.Value)
            {
                return BadRequest(new { error = "Mã OTP đã hết hạn. Vui lòng yêu cầu cấp lại mã mới." });
            }

            // Kiểm tra mã OTP
            if (user.ResetPasswordOtp != req.Otp)
            {
                user.FailedOtpAttempts++;
                if (user.FailedOtpAttempts >= 5)
                {
                    // Quá số lần cho phép -> Hủy mã
                    user.ResetPasswordOtp = null;
                    user.ResetPasswordOtpExpiry = null;
                    user.FailedOtpAttempts = 0;
                    await _db.SaveChangesAsync();
                    return BadRequest(new { error = "Bạn đã nhập sai mã xác thực quá nhiều lần. Mã đã bị hủy, vui lòng yêu cầu cấp lại mã mới." });
                }
                
                await _db.SaveChangesAsync();
                return BadRequest(new { error = "Mã xác thực không chính xác." });
            }

            // Đổi mật khẩu thành công
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            
            // Clear OTP data
            user.ResetPasswordOtp = null;
            user.ResetPasswordOtpExpiry = null;
            user.FailedOtpAttempts = 0;

            await _db.SaveChangesAsync();

            return Ok(new { message = "Mật khẩu của bạn đã được thay đổi thành công." });
        }

        private string GenerateSecureOtp(int length)
        {
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            byte[] randomNumber = new byte[length];
            rng.GetBytes(randomNumber);

            var otp = new System.Text.StringBuilder(length);
            for (int i = 0; i < length; i++)
            {
                // Chuyển đổi byte ngẫu nhiên thành ký tự số (0-9)
                otp.Append((randomNumber[i] % 10).ToString());
            }
            return otp.ToString();
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

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class VerifyOtpRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}
