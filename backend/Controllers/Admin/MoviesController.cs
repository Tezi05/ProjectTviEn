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
        private const string MoviesCacheKey = "movies_all";
        private static readonly DistributedCacheEntryOptions CacheOptions = new() { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2) };

        public MoviesController(AppDbContext context, IR2Service r2Service, IDistributedCache cache, StackExchange.Redis.IConnectionMultiplexer redis, IConfiguration config)
        {
            _context = context; _r2Service = r2Service; _cache = cache; _redis = redis; _config = config;
        }

        [HttpGet]
        public async Task<IActionResult> GetMovies() {
            var camelCase = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var cached = await _cache.GetStringAsync(MoviesCacheKey);
            if (cached != null) return Ok(JsonSerializer.Deserialize<object>(cached, camelCase));

            var movies = await _context.Movies.Where(m => !m.IsDeleted).Select(m => new {
                m.Id, m.Title, m.Slug, m.PosterUrl, m.WeeklyViews, m.WeeklyViewsResetWeek,
                JobStatus = _context.IngestJobs.Where(j => j.MovieId == m.Id).OrderByDescending(j => j.CreatedAt).Select(j => new { j.Status, j.Logs, j.FinishedAt }).FirstOrDefault()
            }).ToListAsync();
            await _cache.SetStringAsync(MoviesCacheKey, JsonSerializer.Serialize(movies, camelCase), CacheOptions);
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
            var movie = await _context.Movies.FirstOrDefaultAsync(m => m.Slug == slug && !m.IsDeleted);
            if (movie == null) return NotFound(new { error = "ERR_SLUG_NOT_FOUND" });
            return Ok(movie);
        }

        [HttpGet("{id}/play")]
        public async Task<IActionResult> GetPlayUrlById(string id) {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound(new { error = "ERR_ID_NOT_FOUND" });
            return await GeneratePlayResponse(movie);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMovieById(string id) {
            var movie = await _context.Movies.FindAsync(id);
            if (movie == null) return NotFound(new { error = "ERR_ID_NOT_FOUND" });
            return Ok(movie);
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
                    Subject = new ClaimsIdentity(new[] { new Claim("movieId", movie.Id), new Claim("title", movie.Title ?? "") }),
                    Issuer = "tvien-backend",
                    Audience = "tvien-worker",
                    Expires = DateTime.UtcNow.AddHours(expHours), 
                    SigningCredentials = credentials
                };
                
                var tokenHandler = new JwtSecurityTokenHandler();
                string tokenString = tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));

                return Ok(new { 
                    MovieId = movie.Id, 
                    Title = movie.Title, 
                    PlayUrl = $"http://localhost:5113/api/public/gatekeeper/video/{movie.Id}/master.m3u8",
                    Token = tokenString,
                    ExpiresInHours = expHours
                });
            } catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}
