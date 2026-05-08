using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ProjectTviEn.Models;
using ProjectTviEn.Services;
using ProjectTviEn.DTOs;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/[controller]")]
    public class MoviesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IR2Service _r2Service;
        private readonly IDistributedCache _cache;
        private readonly StackExchange.Redis.IConnectionMultiplexer _redis;
        private readonly IConfiguration _config;
        private const string MoviesCacheKey = "movies_all";
        private static readonly DistributedCacheEntryOptions CacheOptions = new() { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2) };

        public MoviesController(AppDbContext context, IR2Service r2Service, IDistributedCache cache, StackExchange.Redis.IConnectionMultiplexer redis, IConfiguration config)
        {
            _context = context; _r2Service = r2Service; _cache = cache; _redis = redis; _config = config;
        }

        [HttpGet]
        public async Task<IActionResult> GetMovies() {
            // Xóa cache (Redis optional - nếu không có Redis thì bỏ qua)
            try { await _cache.RemoveAsync(MoviesCacheKey); } catch { }

            var moviesRaw = await _context.Movies.Where(m => !m.IsDeleted).Select(m => new {
                m.Id, 
                MovieId = m.Id, 
                m.Title, 
                m.OriginalTitle,
                m.Slug, 
                m.PosterUrl, 
                m.BackdropUrl,
                m.Description,
                m.ReleaseYear,
                m.AgeRating,
                m.ViewCount, 
                m.Status, 
                m.UpdatedAt
            }).ToListAsync();

            var movies = moviesRaw.Select(m => new {
                m.Id,
                m.MovieId,
                m.Title,
                m.OriginalTitle,
                m.Slug,
                m.Description,
                PosterUrl = !string.IsNullOrEmpty(m.PosterUrl) ? _r2Service.GeneratePresignedDownloadUrl(CleanUrl(m.PosterUrl)) : null,
                BackdropUrl = !string.IsNullOrEmpty(m.BackdropUrl) ? _r2Service.GeneratePresignedDownloadUrl(CleanUrl(m.BackdropUrl)) : null,
                m.ReleaseYear,
                m.AgeRating,
                m.ViewCount,
                m.Status,
                m.UpdatedAt,
                JobStatus = _context.IngestJobs.Where(j => j.MovieId == m.Id).OrderByDescending(j => j.CreatedAt).Select(j => new { j.Status, j.Logs, j.FinishedAt }).FirstOrDefault()
            }).ToList();

            return Ok(movies);
        }

        [HttpGet("slug/{slug}/play")]
        public async Task<IActionResult> GetPlayUrlBySlug(string slug) {
            var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Slug == slug && !m.IsDeleted);
            if (movie == null) return NotFound(new { error = "ERR_SLUG_NOT_FOUND" });
            return await GeneratePlayResponse(movie);
        }

        [HttpGet("slug/{slug}")]
        public async Task<IActionResult> GetMovieBySlug(string slug) {
            var movie = await _context.Movies
                .Include(m => m.Videos.Where(v => !v.IsDeleted))
                .Include(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
                .Include(m => m.MovieCrews).ThenInclude(mc => mc.Person)
                .FirstOrDefaultAsync(m => m.Slug == slug && !m.IsDeleted);
            if (movie == null) return NotFound(new { error = "ERR_SLUG_NOT_FOUND" });

            // Ký URL ảnh
            if (!string.IsNullOrEmpty(movie.PosterUrl)) movie.PosterUrl = _r2Service.GeneratePresignedDownloadUrl(CleanUrl(movie.PosterUrl));
            if (!string.IsNullOrEmpty(movie.BackdropUrl)) movie.BackdropUrl = _r2Service.GeneratePresignedDownloadUrl(CleanUrl(movie.BackdropUrl));

            return Ok(movie);
        }

        [HttpGet("{id}/play")]
        public async Task<IActionResult> GetPlayUrlById(int id) {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound(new { error = "ERR_ID_NOT_FOUND" });
            return await GeneratePlayResponse(movie);
        }

        [HttpGet("image-url/{id}")]
        public IActionResult GetImagePresignedUrl(int id, [FromQuery] string key)
        {
            if (string.IsNullOrEmpty(key)) return BadRequest("Missing key");
            var presignedUrl = _r2Service.GeneratePresignedDownloadUrl(key);
            return Ok(new { url = presignedUrl });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMovieById(int id) {
            var movie = await _context.Movies
                .Include(m => m.Videos.Where(v => !v.IsDeleted))
                .Include(m => m.MovieGenres).ThenInclude(mg => mg.Genre)
                .Include(m => m.MovieCrews).ThenInclude(mc => mc.Person)
                .FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted);

            if (movie == null) return NotFound(new { error = "ERR_ID_NOT_FOUND" });

            // Ký URL ảnh
            if (!string.IsNullOrEmpty(movie.PosterUrl)) movie.PosterUrl = _r2Service.GeneratePresignedDownloadUrl(CleanUrl(movie.PosterUrl));
            if (!string.IsNullOrEmpty(movie.BackdropUrl)) movie.BackdropUrl = _r2Service.GeneratePresignedDownloadUrl(CleanUrl(movie.BackdropUrl));

            return Ok(new {
                movie.Id,
                MovieId = movie.Id,
                movie.Title,
                movie.OriginalTitle,
                movie.Slug,
                movie.Description,
                movie.PosterUrl,
                movie.BackdropUrl,
                movie.TrailerUrl,
                movie.ReleaseYear,
                movie.Duration,
                movie.AgeRating,
                movie.Status,
                movie.ViewCount,
                movie.CreatedAt,
                movie.UpdatedAt,
                Genres = movie.MovieGenres.Select(mg => new { mg.GenreId, mg.Genre?.Name }),
                Crew = movie.MovieCrews.Select(mc => new { mc.PersonId, mc.Person?.FullName, mc.RoleId }),
                Videos = movie.Videos.Select(v => new {
                    v.VideoId,
                    v.Resolution,
                    v.MasterPlaylistUrl,
                    v.IsEncrypted,
                    v.CreatedAt
                })
            });
        }

        [HttpPost]
        public async Task<IActionResult> CreateMovie([FromBody] Movie movie) {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            movie.CreatedAt = DateTime.UtcNow;

            // Xử lý Thể loại
            if (movie.GenreIds != null) {
                foreach (var gid in movie.GenreIds) {
                    movie.MovieGenres.Add(new MovieGenre { GenreId = gid });
                }
            }

            // Xử lý Nhân sự
            if (movie.CrewMembers != null) {
                foreach (var cm in movie.CrewMembers) {
                    movie.MovieCrews.Add(new MovieCrew { PersonId = cm.PersonId, RoleId = cm.RoleId });
                }
            }

            _context.Movies.Add(movie);
            await _context.SaveChangesAsync();
            try { await _cache.RemoveAsync(MoviesCacheKey); } catch { }
            return CreatedAtAction(nameof(GetMovieById), new { id = movie.Id }, movie);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMovie(int id, [FromBody] MovieUpdateDto dto) {
            var movie = await _context.Movies
                .Include(m => m.MovieGenres)
                .Include(m => m.MovieCrews)
                .FirstOrDefaultAsync(m => m.Id == id);
            
            if (movie == null) return NotFound();

            // 1. Cập nhật Metadata cơ bản
            movie.Title = dto.Title;
            movie.OriginalTitle = dto.OriginalTitle;
            movie.Slug = dto.Slug;
            movie.Description = dto.Description;
            movie.ReleaseYear = dto.ReleaseYear;
            movie.Duration = dto.Duration;
            movie.AgeRating = dto.AgeRating;
            movie.Status = dto.Status;
            movie.TrailerUrl = dto.TrailerUrl;
            movie.UpdatedAt = DateTime.UtcNow;

            // Chỉ cập nhật URL nếu nó hợp lệ
            movie.PosterUrl = CleanUrl(dto.PosterUrl);
            movie.BackdropUrl = CleanUrl(dto.BackdropUrl);

            // 2. Cập nhật Thể loại (Xóa cũ, Thêm mới)
            if (movie.MovieGenres != null) _context.MovieGenres.RemoveRange(movie.MovieGenres);
            if (dto.GenreIds != null) {
                foreach (var gId in dto.GenreIds) {
                    movie.MovieGenres?.Add(new MovieGenre { MovieId = id, GenreId = gId });
                }
            }

            // 3. Cập nhật Nhân sự (Xóa cũ, Thêm mới)
            if (movie.MovieCrews != null) _context.MovieCrews.RemoveRange(movie.MovieCrews);
            if (dto.CrewMembers != null) {
                foreach (var cm in dto.CrewMembers) {
                    movie.MovieCrews?.Add(new MovieCrew { MovieId = id, PersonId = cm.PersonId, RoleId = cm.RoleId });
                }
            }

            try {
                await _context.SaveChangesAsync();
                try { await _cache.RemoveAsync(MoviesCacheKey); } catch { }
                return Ok(movie);
            } catch (Exception ex) {
                return StatusCode(500, $"Lỗi lưu database: {ex.Message} {ex.InnerException?.Message}");
            }
        }

        // --- END IMAGE URL ---

        [HttpPost("{id}/upload-poster")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadPoster(int id, [FromForm] FileUploadRequest request) {
            if (request.File == null || request.File.Length == 0) return BadRequest("File không hợp lệ");
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound();

            using var stream = request.File.OpenReadStream();
            string fileName = $"poster_{id}_{DateTime.UtcNow.Ticks}";
            // Poster tỷ lệ 2:3 -> 600x900
            movie.PosterUrl = await _r2Service.UploadImageAsync(stream, "posters", fileName, 600, 900);
            
            await _context.SaveChangesAsync();
            try { await _cache.RemoveAsync(MoviesCacheKey); } catch { }
            return Ok(new { url = movie.PosterUrl });
        }

        [HttpPost("{id}/upload-backdrop")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadBackdrop(int id, [FromForm] FileUploadRequest request) {
            if (request.File == null || request.File.Length == 0) return BadRequest("File không hợp lệ");
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound();

            using var stream = request.File.OpenReadStream();
            string fileName = $"backdrop_{id}_{DateTime.UtcNow.Ticks}";
            // Backdrop tỷ lệ 16:9 -> 1920x1080
            movie.BackdropUrl = await _r2Service.UploadImageAsync(stream, "backdrops", fileName, 1920, 1080);
            
            await _context.SaveChangesAsync();
            try { await _cache.RemoveAsync(MoviesCacheKey); } catch { }
            return Ok(new { url = movie.BackdropUrl });
        }

        [HttpPost("{id}/generate-preview")]
        public async Task<IActionResult> GeneratePreview(int id)
        {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound();

            // Tìm IngestJob để lấy đường dẫn raw video trên R2
            var job = await _context.IngestJobs
                .Where(j => j.MovieId == id && j.Status == "done" && j.RawPath != null)
                .OrderByDescending(j => j.CreatedAt)
                .FirstOrDefaultAsync();
            if (job == null) return BadRequest(new { error = "Không tìm thấy IngestJob hoàn thành cho phim này" });

            // Tìm Video record để lấy HLS prefix
            var video = await _context.Videos
                .FirstOrDefaultAsync(v => v.MovieId == id && !v.IsDeleted);
            if (video == null || string.IsNullOrEmpty(video.MasterPlaylistUrl))
                return BadRequest(new { error = "Chưa có HLS video. Ingest trước." });

            string hlsR2Prefix = video.MasterPlaylistUrl.Substring(0, video.MasterPlaylistUrl.LastIndexOf('/') + 1);
            string previewR2Key = $"{hlsR2Prefix}preview.mp4";

            // Chạy generate preview bất đồng bộ (background)
            _ = Task.Run(async () =>
            {
                var tempDir = Path.Combine(Path.GetTempPath(), $"preview_{id}_{Guid.NewGuid():N}");
                Directory.CreateDirectory(tempDir);
                string inputPath = Path.Combine(tempDir, "input.mp4");
                string previewPath = Path.Combine(tempDir, "preview.mp4");
                try
                {
                    // Tải raw video từ R2
                    var r2 = HttpContext.RequestServices.GetRequiredService<Amazon.S3.IAmazonS3>();
                    var r2Config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
                    var bucket = r2Config["R2:BucketName"] ?? "";
                    var transferUtil = new Amazon.S3.Transfer.TransferUtility(r2);
                    await transferUtil.DownloadAsync(inputPath, bucket, job.RawPath!);

                    // Chạy FFmpeg tạo preview
                    var args = $"-nostdin -y -i \"{inputPath}\" -t 30 -vf scale=640:360 -c:v libx264 -crf 28 -preset ultrafast -an -movflags +faststart \"{previewPath}\"";
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "ffmpeg", Arguments = args,
                        UseShellExecute = false, CreateNoWindow = true,
                        RedirectStandardError = false, RedirectStandardOutput = false
                    };
                    var proc = System.Diagnostics.Process.Start(psi)!;
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));
                    try { await proc.WaitForExitAsync(cts.Token); }
                    catch { proc.Kill(true); }

                    if (proc.ExitCode == 0 && System.IO.File.Exists(previewPath))
                    {
                        await r2.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest
                        {
                            BucketName = bucket, Key = previewR2Key,
                            FilePath = previewPath, DisablePayloadSigning = true
                        });
                    }
                }
                finally { try { Directory.Delete(tempDir, true); } catch { } }
            });

            return Ok(new { message = $"Đang tạo preview cho Movie {id} trong nền. Preview sẽ sẵn sàng sau ~1-2 phút.", previewKey = previewR2Key });
        }

        private async Task<IActionResult> GeneratePlayResponse(Movie movie) {

            try {
                var video = await _context.Videos.FirstOrDefaultAsync(v => v.MovieId == movie.Id && !v.IsDeleted);
                if (video == null) return NotFound(new { error = "ERR_VIDEO_NOT_FOUND", movieId = movie.Id });

                var jwtKey = _config["Jwt:Key"] ?? "tvien-super-secret-jwt-key-at-least-32-characters!!";
                var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
                var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
                
                int expHours = 3;
                var tokenDescriptor = new SecurityTokenDescriptor {
                    Subject = new ClaimsIdentity(new[] { 
                        new Claim("movieId", movie.Id.ToString()), 
                        new Claim("title", movie.Title ?? "") 
                    }),
                    Issuer = "tvien-backend",
                    Audience = "tvien-worker",
                    Expires = DateTime.UtcNow.AddHours(expHours), 
                    SigningCredentials = credentials
                };
                
                var tokenHandler = new JwtSecurityTokenHandler();
                string tokenString = tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));

                // ✅ Dynamic URL: đọc X-Forwarded-Proto từ Reverse Proxy (Render) hoặc nhận diện onrender.com để trả về đúng https, tránh Mixed Content
                var scheme = Request.Headers["X-Forwarded-Proto"].ToString();
                if (string.IsNullOrEmpty(scheme)) {
                    scheme = Request.Host.Host.Contains("onrender.com") ? "https" : Request.Scheme;
                }
                
                var baseUrl = _config["BackendUrl"] 
                    ?? $"{scheme}://{Request.Host}";

                return Ok(new { 
                    MovieId = movie.Id, 
                    Title = movie.Title, 
                    PlayUrl = $"{baseUrl}/api/public/gatekeeper/video/{movie.Id}/master.m3u8",
                    Token = tokenString,
                    ExpiresInHours = expHours
                });
            } catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        private string? CleanUrl(string? url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            if (!url.StartsWith("http")) return url.TrimStart('/');

            var bucketToken = "tvien-media-raw/";
            int idx = url.IndexOf(bucketToken);
            if (idx != -1)
            {
                var path = url.Substring(idx + bucketToken.Length);
                int queryIdx = path.IndexOf('?');
                return queryIdx != -1 ? path.Substring(0, queryIdx) : path;
            }
            return url;
        }
    }
}
