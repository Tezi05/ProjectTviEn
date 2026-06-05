using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Public
{
    [ApiController]
    [Route("api/public/watchhistory")]
    public class WatchHistoryController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ProjectTviEn.Services.IR2Service _r2Service;

        public WatchHistoryController(AppDbContext db, ProjectTviEn.Services.IR2Service r2Service) 
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

        // GET: api/public/watchhistory?userId=xxx
        [HttpGet]
        public async Task<IActionResult> GetHistory([FromQuery] string userId)
        {
            var rawHistory = await _db.WatchHistories
                .Where(h => h.UserId == userId)
                .Include(h => h.Movie)
                .Include(h => h.Episode)
                .OrderByDescending(h => h.WatchedAt)
                .Take(50)
                .Select(h => new {
                    h.HistoryId, h.ProgressSeconds, h.IsCompleted, h.WatchedAt,
                    MovieId = h.Movie != null ? h.Movie.Id : 0,
                    MovieTitle = h.Movie != null ? h.Movie.Title : "",
                    MovieSlug = h.Movie != null ? h.Movie.Slug : "",
                    MoviePosterUrl = h.Movie != null ? h.Movie.PosterUrl : "",
                    Episode = h.Episode == null ? null : new { h.Episode.EpisodeId, h.Episode.Title }
                })
                .ToListAsync();

            var history = rawHistory.Select(h => new {
                h.HistoryId, h.ProgressSeconds, h.IsCompleted, h.WatchedAt,
                Movie = h.MovieId != 0 ? new { 
                    Id = h.MovieId, 
                    Title = h.MovieTitle, 
                    Slug = h.MovieSlug,
                    PosterUrl = !string.IsNullOrEmpty(h.MoviePosterUrl) ? _r2Service.GeneratePresignedDownloadUrl(CleanUrl(h.MoviePosterUrl)) : null 
                } : null,
                h.Episode
            }).ToList();

            return Ok(history);
        }

        // POST: api/public/watchhistory — Cập nhật tiến trình xem
        [HttpPost]
        public async Task<IActionResult> UpdateProgress([FromBody] WatchHistory req)
        {
            // Tìm record cũ hoặc tạo mới
            var existing = await _db.WatchHistories
                .FirstOrDefaultAsync(h => h.UserId == req.UserId
                    && h.MovieId == req.MovieId
                    && h.EpisodeId == req.EpisodeId);

            if (existing != null)
            {
                existing.ProgressSeconds = req.ProgressSeconds;
                existing.IsCompleted     = req.IsCompleted;
                existing.WatchedAt       = DateTime.UtcNow;
            }
            else
            {
                req.WatchedAt = DateTime.UtcNow;
                _db.WatchHistories.Add(req);
            }

            await _db.SaveChangesAsync();
            return Ok("Progress saved");
        }

        // DELETE: api/public/watchhistory/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var history = await _db.WatchHistories.FindAsync(id);
            if (history == null) return NotFound();

            _db.WatchHistories.Remove(history);
            await _db.SaveChangesAsync();
            return Ok("Removed from history");
        }
    }
}
