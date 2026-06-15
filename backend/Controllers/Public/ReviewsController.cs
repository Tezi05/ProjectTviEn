using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Public
{
    [ApiController]
    [Route("api/public/reviews")]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ReviewsController(AppDbContext db) { _db = db; }

        // GET: api/public/reviews?movieId=xxx
        [HttpGet]
        public async Task<IActionResult> GetByMovie([FromQuery] int movieId)
        {
            var reviews = await _db.Reviews
                .Where(r => r.MovieId == movieId)
                .Include(r => r.User)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new {
                    r.ReviewId, r.Rating, r.Content, r.CreatedAt,
                    User = new { r.User!.DisplayName, r.User!.AvatarUrl }
                })
                .ToListAsync();
            return Ok(reviews);
        }

        // POST: api/public/reviews — Viết đánh giá mới
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Review review)
        {
            var exists = await _db.Reviews
                .AnyAsync(r => r.UserId == review.UserId && r.MovieId == review.MovieId);

            if (exists) return Conflict("You already reviewed this movie");

            review.CreatedAt = DateTime.UtcNow;
            review.UpdatedAt = DateTime.UtcNow;
            _db.Reviews.Add(review);
            await _db.SaveChangesAsync();
            return Ok(review);
        }

        // PUT: api/public/reviews/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Review updated)
        {
            var review = await _db.Reviews.FindAsync(id);
            if (review == null) return NotFound();

            review.Rating    = updated.Rating != 0 ? updated.Rating : review.Rating;
            review.Content   = updated.Content ?? review.Content;
            review.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(review);
        }

        // DELETE: api/public/reviews/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var review = await _db.Reviews.FindAsync(id);
            if (review == null) return NotFound();

            _db.Reviews.Remove(review);
            await _db.SaveChangesAsync();
            return Ok("Review deleted");
        }
    }
}
