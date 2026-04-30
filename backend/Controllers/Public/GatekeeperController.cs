using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using ProjectTviEn.Services;
using Amazon.S3;
using Amazon.S3.Model;

namespace ProjectTviEn.Controllers.Public
{
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
            // 1. CHIẾN LƯỢC PUBLIC ASSET (Ảnh, Preview)
            bool isPublicAsset = filePath.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || 
                                 filePath.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                                 filePath.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase);

            if (!isPublicAsset)
            {
                if (string.IsNullOrEmpty(token)) return StatusCode(403, "Missing Token");

                var jwtKey = _config["Jwt:Key"] ?? "tvien-super-secret-jwt-key-at-least-32-characters!!";
                var tokenHandler = new JwtSecurityTokenHandler();
                try {
                    tokenHandler.ValidateToken(token, new TokenValidationParameters {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                        ValidateIssuer = true, ValidIssuer = "tvien-backend",
                        ValidateAudience = true, ValidAudience = "tvien-worker",
                        ValidateLifetime = true, ClockSkew = TimeSpan.Zero
                    }, out SecurityToken validatedToken);
                    
                    var claimMovieId = ((JwtSecurityToken)validatedToken).Claims.FirstOrDefault(x => x.Type == "movieId")?.Value;
                    if (claimMovieId != movieId) return StatusCode(403, "Invalid Movie ID in Token");
                } catch { return StatusCode(403, "Invalid or Expired Token"); }
            }

            // 2. LẤY FILE TỪ R2
            var r2Key = $"stream/{movieId}/{filePath}";
            string presignedUrl = _r2Service.GeneratePresignedDownloadUrl(r2Key);
            
            try {
                var httpClient = new HttpClient();
                var response = await httpClient.GetAsync(presignedUrl, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode);

                var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";

                // ✅ LOGIC THÔNG MINH: Nhúng token vào playlist .m3u8
                if (filePath.EndsWith(".m3u8") && !string.IsNullOrEmpty(token))
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var lines = content.Split(new[] { "\n", "\r\n" }, StringSplitOptions.None);
                    var newContent = new StringBuilder();

                    foreach (var line in lines)
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        if (!line.StartsWith("#"))
                        {
                            var separator = line.Contains("?") ? "&" : "?";
                            newContent.AppendLine($"{line}{separator}token={token}");
                        }
                        else if (line.StartsWith("#EXT-X-KEY"))
                        {
                            newContent.AppendLine(line.Replace(".key\"", $".key?token={token}\""));
                        }
                        else { newContent.AppendLine(line); }
                    }
                    return Content(newContent.ToString(), "application/vnd.apple.mpegurl");
                }

                var stream = await response.Content.ReadAsStreamAsync();
                return File(stream, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
