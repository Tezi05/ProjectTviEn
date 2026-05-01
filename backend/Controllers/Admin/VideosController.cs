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
        public async Task<IActionResult> GetAll([FromQuery] int? movieId, [FromQuery] Guid? episodeId)
        {
            var query = _context.Videos.AsQueryable();
            if (movieId.HasValue)      query = query.Where(v => v.MovieId == movieId);
            if (episodeId.HasValue)    query = query.Where(v => v.EpisodeId == episodeId);

            return Ok(await query.ToListAsync());
        }

        // GET: api/admin/videos/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
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
            if (!video.MovieId.HasValue && !video.EpisodeId.HasValue)
                return BadRequest("Video must belong to a Movie or an Episode");

            video.CreatedAt = DateTime.UtcNow;
            _context.Videos.Add(video);
            await _context.SaveChangesAsync();
            return Ok(video);
        }

        // PUT: api/admin/videos/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] Video updated)
        {
            var video = await _context.Videos.FindAsync(id);
            if (video == null) return NotFound($"Video '{id}' not found");

            video.Resolution        = updated.Resolution ?? video.Resolution;
            video.MasterPlaylistUrl = updated.MasterPlaylistUrl ?? video.MasterPlaylistUrl;
            video.SubtitleUrl       = updated.SubtitleUrl ?? video.SubtitleUrl;
            video.IsEncrypted       = updated.IsEncrypted;
            video.EncryptionKey     = updated.EncryptionKey ?? video.EncryptionKey;
            video.IV                = updated.IV ?? video.IV;
            video.UpdatedAt         = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(video);
        }

        // DELETE: api/admin/videos/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var video = await _context.Videos.FindAsync(id);
            if (video == null) return NotFound($"Video '{id}' not found");

            _context.Videos.Remove(video);
            await _context.SaveChangesAsync();
            return Ok($"Video '{id}' deleted");
        }
    }
}
