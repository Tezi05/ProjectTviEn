using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
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

        // Cache key và thời gian sống (TTL)
        private const string MoviesCacheKey = "movies_all";
        private static readonly DistributedCacheEntryOptions CacheOptions = new()
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        };

        public MoviesController(AppDbContext context, IR2Service r2Service, IDistributedCache cache)
        {
            _context = context;
            _r2Service = r2Service;
            _cache = cache;
        }

        [HttpGet]
        public async Task<IActionResult> GetMovies(){
            var cached = await _cache.GetStringAsync(MoviesCacheKey);
            if (cached != null)
            {
                var cachedMovies = JsonSerializer.Deserialize<object>(cached);
                return Ok(cachedMovies);
            }

            var movies = await _context.Movies
                .Select(m => new {
                    m.Id,
                    m.Title,
                    m.Slug,
                    JobStatus = _context.IngestJobs
                        .Where(j => j.MovieId == m.Id)
                        .OrderByDescending(j => j.CreatedAt)
                        .Select(j => new { j.Status, j.Logs, j.FinishedAt })
                        .FirstOrDefault()
                })
                .ToListAsync();

            var json = JsonSerializer.Serialize(movies);
            await _cache.SetStringAsync(MoviesCacheKey, json, CacheOptions);

            return Ok(movies);
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

            var uploadUrl = _r2Service.GeneratePresignedUploadUrl(job.RawPath);

            return Ok(new
            {
                Message = "Movie created! Please upload video to the URL below. Worker will wait for 45s.",
                MovieId = movie.Id,
                JobId = job.JobId,
                UploadUrl = uploadUrl
            });
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

            var uploadUrl = _r2Service.GeneratePresignedUploadUrl(job.RawPath);

            return Ok(new
            {
                Message = "Re-ingest job created! Please upload the new video to the URL below.",
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

            string masterPlaylistKey = $"stream/{id}/master.m3u8";
            string signedUrl = _r2Service.GeneratePresignedDownloadUrl(masterPlaylistKey);

            return Ok(new
            {
                MovieId = id,
                Title = movie.Title,
                PlayUrl = signedUrl,
                ExpiresInHours = 2
            });
        }
    }
}
