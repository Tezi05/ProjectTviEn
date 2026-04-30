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

        // Cache key và thời gian sống (TTL)
        private const string MoviesCacheKey = "movies_all";
        private static readonly DistributedCacheEntryOptions CacheOptions = new()
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        };

        public MoviesController(AppDbContext context, IR2Service r2Service, IDistributedCache cache, StackExchange.Redis.IConnectionMultiplexer redis, IConfiguration config)
        {
            _context = context;
            _r2Service = r2Service;
            _cache = cache;
            _redis = redis;
            _config = config;
        }

        [HttpGet]
        public async Task<IActionResult> GetMovies(){
            var camelCase = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

            var cached = await _cache.GetStringAsync(MoviesCacheKey);
            if (cached != null)
            {
                var cachedMovies = JsonSerializer.Deserialize<object>(cached, camelCase);
                return Ok(cachedMovies);
            }

            var movies = await _context.Movies
                .Where(m => !m.IsDeleted)
                .Select(m => new {
                    m.Id,
                    m.Title,
                    m.Slug,
                    m.PosterUrl,
                    m.WeeklyViews,
                    m.WeeklyViewsResetWeek,
                    JobStatus = _context.IngestJobs
                        .Where(j => j.MovieId == m.Id)
                        .OrderByDescending(j => j.CreatedAt)
                        .Select(j => new { j.Status, j.Logs, j.FinishedAt })
                        .FirstOrDefault()
                })
                .ToListAsync();

            var json = JsonSerializer.Serialize(movies, camelCase);
            await _cache.SetStringAsync(MoviesCacheKey, json, CacheOptions);

            return Ok(movies);
        }

        // GET: api/admin/Movies/search?keyword=mai&limit=10
        [HttpGet("search")]
        public async Task<IActionResult> SearchMovies([FromQuery] string keyword = "", [FromQuery] int limit = 10)
        {
            var q = _context.Movies.Where(m => !m.IsDeleted);
            if (!string.IsNullOrWhiteSpace(keyword))
                q = q.Where(m => m.Title.ToLower().Contains(keyword.ToLower()));
            var results = await q
                .OrderBy(m => m.Title)
                .Take(limit)
                .Select(m => new { m.Id, m.Title, m.PosterUrl, m.Slug })
                .ToListAsync();
            return Ok(results);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMovie(string id)
        {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound($"Movie '{id}' not found");
            return Ok(movie);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMovie(string id){
            var movieDelete = await _context.Movies
                .Include(m => m.IngestJobs)
                .Include(m => m.MediaAssets)
                .Include(m => m.Stream)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (movieDelete == null)
            {
                return NotFound($"Movie '{id}' not found");
            }

            _context.Movies.Remove(movieDelete);
            await _context.SaveChangesAsync();
            await _cache.RemoveAsync(MoviesCacheKey);

            return Ok($"Movie '{movieDelete.Title}' deleted successfully");
        }

        [HttpPost("{id}/purge-storage")]
        public async Task<IActionResult> PurgeStorage(string id){

            var movie = await _context.Movies.FindAsync(id);
            if (movie == null)
            {
                return NotFound($"Movie '{id}' not found");
            }

            await _r2Service.DeleteFilesWithPrefix($"raw/{id}/");
            await _r2Service.DeleteFilesWithPrefix($"stream/{id}/");

            return Ok(new
            {
                Message = $"All R2 files for '{movie.Title}' deleted successfully",
                DeletedPrefixes = new[] { $"raw/{id}/", $"stream/{id}/" }
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMovie(string id, [FromBody] Movie updated){
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound($"Movie '{id}' not found");

            movie.Title                = updated.Title ?? movie.Title;
            movie.Slug                 = updated.Slug ?? movie.Slug;
            movie.Description          = updated.Description ?? movie.Description;
            movie.PosterUrl            = updated.PosterUrl ?? movie.PosterUrl;
            movie.Duration             = updated.Duration ?? movie.Duration;
            movie.ReleaseYear          = updated.ReleaseYear ?? movie.ReleaseYear;
            movie.Country              = updated.Country ?? movie.Country;
            movie.Language             = updated.Language ?? movie.Language;
            movie.TrailerUrl           = updated.TrailerUrl ?? movie.TrailerUrl;
            movie.MovieType            = updated.MovieType ?? movie.MovieType;
            movie.ImdbScore            = updated.ImdbScore ?? movie.ImdbScore;
            movie.RottenTomatoesScore  = updated.RottenTomatoesScore ?? movie.RottenTomatoesScore;

            await _context.SaveChangesAsync();
            await _cache.RemoveAsync(MoviesCacheKey);
            return Ok(movie);
        }

        [HttpPost]
        public async Task<IActionResult> CreateMovie([FromBody] Movie movie){
            if (string.IsNullOrEmpty(movie.Id))
            {
                return BadRequest("ID is required");
            }
            if (await _context.Movies.AnyAsync(m => m.Id == movie.Id))
            {
                return BadRequest("ID phim này đã tồn tại trên hệ thống!");
            }
            if (string.IsNullOrEmpty(movie.Title))
            {
                return BadRequest("Title is required");
            }

            movie.CreatedAt = DateTime.UtcNow;
            _context.Movies.Add(movie);
            
            var job = new IngestJob
            {
                JobId = Guid.NewGuid().ToString(),
                MovieId = movie.Id,
                Status = "pending", 
                CreatedAt = DateTime.UtcNow,
                Priority = 1,
                RawPath = $"raw/{movie.Id}/{movie.Slug}.mp4"
            };
            _context.IngestJobs.Add(job);
            
            await _context.SaveChangesAsync();

            await _cache.RemoveAsync(MoviesCacheKey);

            var uploadUrl = _r2Service.GeneratePresignedUploadUrl(job.RawPath, 60); // 1 giờ khóa an toàn

            return Ok(new
            {
                Message = "Movie created! Use UploadUrl to upload file, then call start-processing.",
                MovieId = movie.Id,
                JobId = job.JobId,
                UploadUrl = uploadUrl
            });
        }

        [HttpPost("{id}/start-processing/{jobId}")]
        public async Task<IActionResult> StartProcessing(string id, string jobId){
            var job = await _context.IngestJobs.FirstOrDefaultAsync(j => j.JobId == jobId && j.MovieId == id);
            if (job == null) return NotFound("Job not found");

            // Kích hoạt: Đẩy JobId vào Redis Queue sau khi Frontend đã upload xong
            var dbRedis = _redis.GetDatabase();
            await dbRedis.ListLeftPushAsync("tvien:ingest_queue", job.JobId);

            return Ok(new { Message = "Job queued successfully!" });
        }

        [HttpGet("{id}/progress")]
        public async Task<IActionResult> GetProgress(string id){
            var dbRedis = _redis.GetDatabase();
            var progressJson = await dbRedis.StringGetAsync($"job:progress:{id}");
            
            if (progressJson.IsNullOrEmpty) return Ok(new { Status = "unknown", Percent = 0, Detail = "Chưa có thông tin hoặc Worker chưa bắt đầu." });

            return Ok(progressJson.ToString());
        }

        [HttpPost("{id}/assets")]
        public async Task<IActionResult> UploadAsset(string id, [FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("File is empty");

            string fileName = file.FileName.ToLower();
            string r2Key = "";
            string contentType = "";

            if (fileName.EndsWith(".jpg") || fileName.EndsWith(".jpeg") || fileName.EndsWith(".png"))
            {
                r2Key = $"stream/{id}/thumbnail.jpg";
                contentType = "image/jpeg";
            }
            else if (fileName.EndsWith(".mp4"))
            {
                r2Key = $"stream/{id}/preview.mp4";
                contentType = "video/mp4";
            }
            else
            {
                return BadRequest("Only .jpg/.png for thumbnail or .mp4 for preview are supported.");
            }

            using var stream = file.OpenReadStream();
            
            // Dùng thư viện AWSSDK.S3 để PUT trực tiếp Stream lên R2
            // Vì IR2Service chưa có hàm UploadStream, ta truy cập trực tiếp qua configuration
            var accessKey = _config["R2:AccessKey"];
            var secretKey = _config["R2:SecretKey"];
            var serviceUrl = _config["R2:Endpoint"];
            var bucketName = _config["R2:BucketName"];

            var config = new Amazon.S3.AmazonS3Config { 
                ServiceURL = serviceUrl, 
                ForcePathStyle = true,
                SignatureVersion = "4", 
                AuthenticationRegion = "auto" 
            };
            var credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey);
            using var s3Client = new Amazon.S3.AmazonS3Client(credentials, config);

            var putRequest = new Amazon.S3.Model.PutObjectRequest
            {
                BucketName = bucketName,
                Key = r2Key,
                InputStream = stream,
                ContentType = contentType,
                DisablePayloadSigning = true
            };

            await s3Client.PutObjectAsync(putRequest);

            return Ok(new { Message = $"Asset {r2Key} uploaded successfully!" });
        }

        [HttpPost("{id}/custom-poster")]
        public async Task<IActionResult> UploadCustomPoster(string id, [FromForm] IFormFile file)
        {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound("Movie not found");
            if (file == null || file.Length == 0) return BadRequest("File is empty");

            string r2Key = $"stream/{id}/thumbnail.jpg";
            
            var accessKey = _config["R2:AccessKey"];
            var secretKey = _config["R2:SecretKey"];
            var serviceUrl = _config["R2:Endpoint"];
            var bucketName = _config["R2:BucketName"];

            var config = new Amazon.S3.AmazonS3Config { 
                ServiceURL = serviceUrl, 
                ForcePathStyle = true,
                SignatureVersion = "4", 
                AuthenticationRegion = "auto" 
            };
            var credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey);
            using var s3Client = new Amazon.S3.AmazonS3Client(credentials, config);

            using var stream = file.OpenReadStream();
            var putRequest = new Amazon.S3.Model.PutObjectRequest
            {
                BucketName = bucketName,
                Key = r2Key,
                InputStream = stream,
                ContentType = "image/jpeg",
                DisablePayloadSigning = true
            };
            await s3Client.PutObjectAsync(putRequest);

            // Cập nhật Database ưu tiên hiển thị ảnh này (giờ đã đồng bộ tên là thumbnail.jpg)
            movie.PosterUrl = $"http://localhost:5113/api/public/gatekeeper/video/{id}/thumbnail.jpg";
            await _context.SaveChangesAsync();
            await _cache.RemoveAsync(MoviesCacheKey);

            return Ok(new { Message = "Custom poster uploaded", PosterUrl = movie.PosterUrl });
        }

        [HttpPost("{id}/re-ingest")]
        public async Task<IActionResult> ReIngest(string id){
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null)
            {
                return NotFound("Movie not found");
            }

            var job = new IngestJob
            {
                JobId = Guid.NewGuid().ToString(),
                MovieId = movie.Id,
                Status = "pending", 
                CreatedAt = DateTime.UtcNow,
                Priority = 2,
                RawPath = $"raw/{movie.Id}/{movie.Slug}-update.mp4"
            };
            _context.IngestJobs.Add(job);
            
            await _context.SaveChangesAsync();

            await _cache.RemoveAsync(MoviesCacheKey);

            var uploadUrl = _r2Service.GeneratePresignedUploadUrl(job.RawPath, 60);

            return Ok(new
            {
                Message = "Re-ingest job created! Use UploadUrl to upload file, then call start-processing.",
                MovieId = movie.Id,
                JobId = job.JobId,
                UploadUrl = uploadUrl
            });
        }

        [HttpGet("{id}/play")]
        public async Task<IActionResult> GetPlayUrl(string id){
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null)
            {
                return NotFound("Movie not found");
            }

            // --- TĂNG LƯỢT XEM (TRENDING TUẦN) ---
            var currentWeek = System.Globalization.ISOWeek.GetWeekOfYear(DateTime.UtcNow);
            if (movie.WeeklyViewsResetWeek != currentWeek) {
                movie.WeeklyViews = 1;
                movie.WeeklyViewsResetWeek = currentWeek;
            } else {
                movie.WeeklyViews += 1;
            }
            await _context.SaveChangesAsync();
            await _cache.RemoveAsync(MoviesCacheKey);

            // --- SINH VÉ THÔNG HÀNH (JWT) ---
            // Hoàn toàn dùng CPU, không gọi tới R2 API => Siêu nhanh
            var jwtKey   = _config["Jwt:Key"] ?? "tvien-super-secret-jwt-key-at-least-32-characters!!";
            // Dùng Controller Local làm Gatekeeper giả lập để test
            var jwtWorkerBase = _config["Jwt:WorkerBaseUrl"] ?? "http://localhost:5113/api/public/gatekeeper";
            var expHours = 3;

            var securityKey  = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials  = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim("movieId", id),
                new Claim("title",   movie.Title ?? ""),
            };

            var tokenDescriptor = new JwtSecurityToken(
                issuer:             "tvien-backend",
                audience:           "tvien-worker",
                claims:             claims,
                expires:            DateTime.UtcNow.AddHours(expHours),
                signingCredentials: credentials
            );

            var token    = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
            var playUrl  = $"{jwtWorkerBase}/video/{id}/master.m3u8?token={token}";

            return Ok(new
            {
                movieId  = id,
                title    = movie.Title,
                playUrl  = playUrl,
                token    = token,
                expiresInHours = expHours
            });
        }

        public class ImportRequest
        {
            public string FileKey { get; set; } = string.Empty; // Ví dụ: "data/movies.json"
        }

        [HttpPost("import-from-r2")]
        public async Task<IActionResult> ImportFromR2([FromBody] ImportRequest request)
        {
            if (string.IsNullOrEmpty(request.FileKey))
                return BadRequest("FileKey is required");

            var jsonContent = await _r2Service.GetFileContentAsync(request.FileKey);
            
            if (jsonContent == null)
                return NotFound($"File '{request.FileKey}' not found on R2");

            List<Movie>? moviesToImport;
            try
            {
                moviesToImport = JsonSerializer.Deserialize<List<Movie>>(jsonContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Invalid JSON format: {ex.Message}");
            }

            if (moviesToImport == null || moviesToImport.Count == 0)
                return BadRequest("No movies found in the JSON file");

            int addedCount = 0;
            int skippedCount = 0;

            foreach (var movieData in moviesToImport)
            {
                // Kiểm tra xem phim đã tồn tại chưa (dựa vào Slug)
                bool exists = await _context.Movies.AnyAsync(m => m.Slug == movieData.Slug || m.Title == movieData.Title);
                
                if (exists)
                {
                    skippedCount++;
                    continue; // Bỏ qua phim đã tồn tại
                }

                // Chặn không cho ghi đè ID từ JSON trừ khi bạn muốn, ở đây tạo ID mới để an toàn
                var newMovie = new Movie
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Title = movieData.Title,
                    Slug = movieData.Slug,
                    Description = movieData.Description,
                    PosterUrl = movieData.PosterUrl,
                    Duration = movieData.Duration,
                    ReleaseYear = movieData.ReleaseYear,
                    Country = movieData.Country,
                    Language = movieData.Language,
                    TrailerUrl = movieData.TrailerUrl,
                    MovieType = string.IsNullOrEmpty(movieData.MovieType) ? "movie" : movieData.MovieType,
                    ImdbScore = movieData.ImdbScore,
                    RottenTomatoesScore = movieData.RottenTomatoesScore,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Movies.Add(newMovie);
                addedCount++;
            }

            await _context.SaveChangesAsync();
            await _cache.RemoveAsync(MoviesCacheKey);

            return Ok(new
            {
                Message = "Import completed",
                TotalFound_InFile = moviesToImport.Count,
                Success_Added = addedCount,
                Skipped = skippedCount
            });
        }
    }
}
