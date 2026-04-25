using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using ProjectTviEn.Services;
using Amazon.S3;
using Amazon.S3.Model;

namespace ProjectTviEn.Controllers.Public
{
    /// <summary>
    /// BỘ GIẢ LẬP CLOUDFLARE WORKER (Dành cho môi trường Local / Testing)
    /// Đóng vai trò làm "Người gác cổng", xác thực JWT và proxy file từ R2.
    /// </summary>
    [ApiController]
    [Route("api/public/gatekeeper")]
    public class GatekeeperController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly IR2Service _r2Service;

        public GatekeeperController(IConfiguration config, IR2Service r2Service)
        {
            _config = config;
            _r2Service = r2Service;
        }

        [HttpGet("video/{movieId}/{**filePath}")]
        public async Task<IActionResult> ProxyVideo(string movieId, string filePath, [FromQuery] string? token)
        {
            // 1. CHIẾN LƯỢC PUBLIC ASSET (Bỏ qua kiểm tra vé với file ảnh và video preview)
            bool isPublicAsset = filePath.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || 
                                 filePath.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                                 filePath.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase);

            if (!isPublicAsset)
            {
                // 2. KIỂM TRA TOKEN BẮT BUỘC (Cho file HLS .m3u8, .ts, .key)
                if (string.IsNullOrEmpty(token))
                {
                    return StatusCode(403, "Forbidden: Thiếu vé thông hành (Token).");
                }

                // 3. XÁC THỰC JWT
                var jwtKey = _config["Jwt:Key"] ?? "tvien-super-secret-jwt-key-at-least-32-characters!!";
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.UTF8.GetBytes(jwtKey);

                try
                {
                    tokenHandler.ValidateToken(token, new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(key),
                        ValidateIssuer = true,
                        ValidIssuer = "tvien-backend",
                        ValidateAudience = true,
                        ValidAudience = "tvien-worker",
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero
                    }, out SecurityToken validatedToken);
                    
                    var jwtToken = (JwtSecurityToken)validatedToken;
                    var claimMovieId = jwtToken.Claims.FirstOrDefault(x => x.Type == "movieId")?.Value;
                    
                    if (claimMovieId != movieId)
                    {
                        return StatusCode(403, "Forbidden: Token không dành cho phim này.");
                    }
                }
                catch (Exception)
                {
                    return StatusCode(403, "Forbidden: Token không hợp lệ hoặc đã hết hạn.");
                }
            }

            // 3. TẢI FILE TỪ R2 NẾU TOKEN HỢP LỆ
            var r2Key = $"stream/{movieId}/{filePath}";
            string presignedUrl = _r2Service.GeneratePresignedDownloadUrl(r2Key);
            
            Console.WriteLine($"[Gatekeeper] Request: {filePath} for Movie: {movieId} (Public: {isPublicAsset})");

            // DÙNG HTTPCLIENT ĐỂ LẤY STREAM VÀ TRẢ VỀ (Bypass CORS của R2)
            try 
            {
                var httpClient = new HttpClient();
                var response = await httpClient.GetAsync(presignedUrl, HttpCompletionOption.ResponseHeadersRead);
                
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[Gatekeeper] [X] R2 Error: {response.StatusCode} for {r2Key}");
                    return StatusCode((int)response.StatusCode, "Lỗi khi tải file từ R2.");
                }

                var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
                var stream = await response.Content.ReadAsStreamAsync();
                
                Console.WriteLine($"[Gatekeeper] [v] Serving {filePath} ({contentType})");
                return File(stream, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi nội bộ: {ex.Message}");
            }
        }
    }
}
