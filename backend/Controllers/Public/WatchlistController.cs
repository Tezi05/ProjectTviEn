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

        public WatchlistController(AppDbContext db) { _db = db; }

        // GET: api/public/watchlist?userId=xxx
        [HttpGet]
        public async Task<IActionResult> GetWatchlist([FromQuery] string userId)
        {
            var list = await _db.Watchlists
                .Where(w => w.UserId == userId)
                .Include(w => w.Movie)
                .OrderByDescending(w => w.AddedAt)
                .Select(w => new {
                    w.WatchlistId, w.AddedAt,
                    Movie = new { w.Movie.Id, w.Movie.Title, w.Movie.PosterUrl, w.Movie.ImdbScore }
                })
                .ToListAsync();
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
