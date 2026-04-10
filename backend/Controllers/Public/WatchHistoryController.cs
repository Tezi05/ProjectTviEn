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

        public WatchHistoryController(AppDbContext db) { _db = db; }

        // GET: api/public/watchhistory?userId=xxx
        [HttpGet]
        public async Task<IActionResult> GetHistory([FromQuery] string userId)
        {
            var history = await _db.WatchHistories
                .Where(h => h.UserId == userId)
                .Include(h => h.Movie)
                .Include(h => h.Episode)
                .OrderByDescending(h => h.WatchedAt)
                .Take(50)
                .Select(h => new {
                    h.HistoryId, h.ProgressSeconds, h.IsCompleted, h.WatchedAt,
                    Movie   = h.Movie == null   ? null : new { h.Movie.Id, h.Movie.Title, h.Movie.PosterUrl },
                    Episode = h.Episode == null ? null : new { h.Episode.EpisodeId, h.Episode.Title }
                })
                .ToListAsync();
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
