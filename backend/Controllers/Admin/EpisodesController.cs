using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin")]
    public class EpisodesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EpisodesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/movies/{movieId}/episodes
        [HttpGet("movies/{movieId}/episodes")]
        public async Task<IActionResult> GetByMovie(string movieId)
        {
            var episodes = await _context.Episodes
                .Where(e => e.MovieId == movieId)
                .OrderBy(e => e.SeasonNumber)
                .ThenBy(e => e.EpisodeNumber)
                .ToListAsync();
            return Ok(episodes);
        }

        // GET: api/admin/episodes/{id}
        [HttpGet("episodes/{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var episode = await _context.Episodes
                .Include(e => e.Videos)
                .FirstOrDefaultAsync(e => e.EpisodeId == id);

            if (episode == null) return NotFound($"Episode '{id}' not found");
            return Ok(episode);
        }

        // POST: api/admin/movies/{movieId}/episodes
        [HttpPost("movies/{movieId}/episodes")]
        public async Task<IActionResult> Create(string movieId, [FromBody] Episode episode)
        {
            var movie = await _context.Movies.FindAsync(movieId);
            if (movie == null) return NotFound($"Movie '{movieId}' not found");

            episode.MovieId = movieId;
            _context.Episodes.Add(episode);
            await _context.SaveChangesAsync();
            return Ok(episode);
        }

        // PUT: api/admin/episodes/{id}
        [HttpPut("episodes/{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Episode updated)
        {
            var episode = await _context.Episodes.FindAsync(id);
            if (episode == null) return NotFound($"Episode '{id}' not found");

            episode.SeasonNumber  = updated.SeasonNumber != 0 ? updated.SeasonNumber : episode.SeasonNumber;
            episode.EpisodeNumber = updated.EpisodeNumber != 0 ? updated.EpisodeNumber : episode.EpisodeNumber;
            episode.Title         = updated.Title ?? episode.Title;
            episode.Description   = updated.Description ?? episode.Description;
            episode.Duration      = updated.Duration ?? episode.Duration;
            episode.AirDate       = updated.AirDate ?? episode.AirDate;

            await _context.SaveChangesAsync();
            return Ok(episode);
        }

        // DELETE: api/admin/episodes/{id}
        [HttpDelete("episodes/{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var episode = await _context.Episodes.FindAsync(id);
            if (episode == null) return NotFound($"Episode '{id}' not found");

            _context.Episodes.Remove(episode);
            await _context.SaveChangesAsync();
            return Ok($"Episode '{episode.Title}' deleted");
        }
    }
}
