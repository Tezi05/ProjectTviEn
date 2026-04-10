using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/videos")]
    public class VideosController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VideosController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/videos?movieId=xxx
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? movieId, [FromQuery] string? episodeId)
        {
            var query = _context.Videos.AsQueryable();
            if (!string.IsNullOrEmpty(movieId))   query = query.Where(v => v.MovieId == movieId);
            if (!string.IsNullOrEmpty(episodeId)) query = query.Where(v => v.EpisodeId == episodeId);

            return Ok(await query.ToListAsync());
        }

        // GET: api/admin/videos/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var video = await _context.Videos.FindAsync(id);
            if (video == null) return NotFound($"Video '{id}' not found");
            return Ok(video);
        }

        // POST: api/admin/videos
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Video video)
        {
            if (string.IsNullOrEmpty(video.Resolution))
                return BadRequest("Resolution is required");
            if (string.IsNullOrEmpty(video.MovieId) && string.IsNullOrEmpty(video.EpisodeId))
                return BadRequest("Video must belong to a Movie or an Episode");

            video.CreatedAt = DateTime.UtcNow;
            _context.Videos.Add(video);
            await _context.SaveChangesAsync();
            return Ok(video);
        }

        // PUT: api/admin/videos/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Video updated)
        {
            var video = await _context.Videos.FindAsync(id);
            if (video == null) return NotFound($"Video '{id}' not found");

            video.Resolution        = updated.Resolution ?? video.Resolution;
            video.MasterPlaylistUrl = updated.MasterPlaylistUrl ?? video.MasterPlaylistUrl;
            video.SubtitleUrl       = updated.SubtitleUrl ?? video.SubtitleUrl;
            video.IsEncrypted       = updated.IsEncrypted;

            await _context.SaveChangesAsync();
            return Ok(video);
        }

        // DELETE: api/admin/videos/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var video = await _context.Videos.FindAsync(id);
            if (video == null) return NotFound($"Video '{id}' not found");

            _context.Videos.Remove(video);
            await _context.SaveChangesAsync();
            return Ok($"Video '{id}' deleted");
        }
    }
}
