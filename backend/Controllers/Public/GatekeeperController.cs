using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using ProjectTviEn.Services;
using ProjectTviEn.Models;
using Microsoft.EntityFrameworkCore;
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
        private readonly AppDbContext _db;

        public GatekeeperController(IConfiguration config, IR2Service r2Service, AppDbContext db)
        {
            _config = config;
            _r2Service = r2Service;
            _db = db;
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

            // 2. XÁC ĐỊNH R2 KEY DỰA TRÊN DATABASE
            // Chiến lược: Series → Season1→Episode1→Video | Phim lẻ → Video gắn MovieId
            string r2Key = "";
            if (int.TryParse(movieId, out int movieIntId))
            {
                Video? videoRecord = null;

                // Dùng movie.Type để phân biệt Series/SingleMovie — không cần query Seasons
                var movie = await _db.Movies.AsNoTracking()
                    .FirstOrDefaultAsync(m => m.Id == movieIntId && !m.IsDeleted);

                if (movie?.Type == MovieType.TvSeries)
                {
                    string? claimEpisodeId = null;
                    if (!string.IsNullOrEmpty(token))
                    {
                        try {
                            var tokenHandler = new JwtSecurityTokenHandler();
                            var jwtToken = tokenHandler.ReadJwtToken(token);
                            claimEpisodeId = jwtToken.Claims.FirstOrDefault(x => x.Type == "episodeId")?.Value;
                        } catch {}
                    }

                    if (!string.IsNullOrEmpty(claimEpisodeId) && Guid.TryParse(claimEpisodeId, out Guid epGuid))
                    {
                        videoRecord = await _db.Videos
                            .AsNoTracking()
                            .Where(v => v.EpisodeId == epGuid && !v.IsDeleted && !string.IsNullOrEmpty(v.MasterPlaylistUrl))
                            .FirstOrDefaultAsync();
                    }
                    else
                    {
                        // Series: bắt buộc đi Season 1 → Episode 1 → Video
                        var firstEpisode = await _db.Episodes
                            .Where(e => e.MovieId == movieIntId && !e.IsDeleted)
                            .OrderBy(e => e.SeasonNumber)
                            .ThenBy(e => e.EpisodeNumber)
                            .FirstOrDefaultAsync();

                        if (firstEpisode != null)
                        {
                            videoRecord = await _db.Videos
                                .AsNoTracking()
                                .Where(v => v.EpisodeId == firstEpisode.EpisodeId && !v.IsDeleted
                                            && !string.IsNullOrEmpty(v.MasterPlaylistUrl))
                                .FirstOrDefaultAsync();
                        }
                    }
                }
                else
                {
                    // SingleMovie: lấy video gắn trực tiếp MovieId, không qua Episode
                    videoRecord = await _db.Videos
                        .AsNoTracking()
                        .Where(v => v.MovieId == movieIntId && v.EpisodeId == null
                                    && !v.IsDeleted && !string.IsNullOrEmpty(v.MasterPlaylistUrl))
                        .FirstOrDefaultAsync();
                }

                if (videoRecord != null && !string.IsNullOrEmpty(videoRecord.MasterPlaylistUrl))
                {
                    var masterUrl = videoRecord.MasterPlaylistUrl;
                    var baseFolder = masterUrl.Substring(0, masterUrl.LastIndexOf('/') + 1);
                    r2Key = $"{baseFolder}{filePath}";
                }
            }

            // Fallback nếu không tìm thấy trong DB
            if (string.IsNullOrEmpty(r2Key))
            {
                r2Key = $"stream/{movieId}/{filePath}";
            }

            string targetUrl = "";
            if (r2Key.StartsWith("http://") || r2Key.StartsWith("https://"))
            {
                targetUrl = r2Key;
            }
            else
            {
                targetUrl = _r2Service.GeneratePresignedDownloadUrl(r2Key);
            }
            
            try {
                var httpClient = new HttpClient();
                var response = await httpClient.GetAsync(targetUrl, HttpCompletionOption.ResponseHeadersRead);
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
                            // Tìm vị trí URI="... " và chèn token vào cuối URL đó
                            int uriStart = line.IndexOf("URI=\"");
                            if (uriStart != -1)
                            {
                                int urlStart = uriStart + 5;
                                int urlEnd = line.IndexOf("\"", urlStart);
                                if (urlEnd != -1)
                                {
                                    string originalUrl = line.Substring(urlStart, urlEnd - urlStart);
                                    
                                    // Trích xuất ID khóa bằng cách lấy phần cuối cùng của đường dẫn (loại bỏ query nếu có)
                                    string keyId = originalUrl;
                                    int qPos = keyId.IndexOf('?');
                                    if (qPos != -1) keyId = keyId.Substring(0, qPos);
                                    keyId = keyId.Substring(keyId.LastIndexOf('/') + 1);

                                    // Tạo URL tuyệt đối động trỏ về backend hiện tại (Local hoặc Render)
                                    string newUrl = $"{Request.Scheme}://{Request.Host}/api/public/keys/{keyId}?token={token}";
                                    newContent.AppendLine(line.Replace(originalUrl, newUrl));
                                    continue;
                                }
                            }
                            newContent.AppendLine(line);
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
