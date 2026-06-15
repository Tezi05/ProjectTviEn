using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Public
{
    [ApiController]
    [Route("api/public/watchlist")]
    public class WatchlistController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ProjectTviEn.Services.IR2Service _r2Service;

        public WatchlistController(AppDbContext db, ProjectTviEn.Services.IR2Service r2Service) 
        { 
            _db = db; 
            _r2Service = r2Service;
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

        // GET: api/public/watchlist?userId=xxx
        [HttpGet]
        public async Task<IActionResult> GetWatchlist([FromQuery] string userId)
        {
            var listRaw = await _db.Watchlists
                .Where(w => w.UserId == userId)
                .Include(w => w.Movie)
                .OrderByDescending(w => w.AddedAt)
                .Select(w => new {
                    w.WatchlistId, w.AddedAt,
                    MovieId = w.Movie != null ? w.Movie.Id : 0,
                    MovieTitle = w.Movie != null ? w.Movie.Title : "",
                    MovieSlug = w.Movie != null ? w.Movie.Slug : "",
                    MoviePosterUrl = w.Movie != null ? w.Movie.PosterUrl : ""
                })
                .ToListAsync();

            var list = listRaw.Select(w => new {
                w.WatchlistId, w.AddedAt,
                Movie = new { 
                    Id = w.MovieId, 
                    Title = w.MovieTitle, 
                    Slug = w.MovieSlug,
                    PosterUrl = !string.IsNullOrEmpty(w.MoviePosterUrl) ? _r2Service.GeneratePresignedDownloadUrl(CleanUrl(w.MoviePosterUrl)!) : null 
                }
            }).ToList();

            return Ok(list);
        }

        // POST: api/public/watchlist — Thêm phim vào danh sách
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] Watchlist req)
        {
            var exists = await _db.Watchlists
                .AnyAsync(w => w.UserId == req.UserId && w.MovieId == req.MovieId);

            if (exists) return Conflict("Movie already in watchlist");

            req.AddedAt = DateTime.UtcNow;
            _db.Watchlists.Add(req);
            await _db.SaveChangesAsync();
            return Ok("Movie added to watchlist");
        }

        // DELETE: api/public/watchlist/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Remove(int id)
        {
            var item = await _db.Watchlists.FindAsync(id);
            if (item == null) return NotFound();

            _db.Watchlists.Remove(item);
            await _db.SaveChangesAsync();
            return Ok("Removed from watchlist");
        }
    }
}
