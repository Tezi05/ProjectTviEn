using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/genres")]
    public class GenresController : ControllerBase
    {
        private readonly AppDbContext _context;

        public GenresController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/genres
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var genres = await _context.Genres
                .OrderBy(g => g.Name)
                .ToListAsync();
            return Ok(genres);
        }

        // POST: api/admin/genres
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Genre genre)
        {
            if (string.IsNullOrEmpty(genre.Name))
                return BadRequest("Name is required");

            _context.Genres.Add(genre);
            await _context.SaveChangesAsync();
            return Ok(genre);
        }

        // PUT: api/admin/genres/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Genre updated)
        {
            var genre = await _context.Genres.FindAsync(id);
            if (genre == null) return NotFound($"Genre '{id}' not found");

            genre.Name = updated.Name ?? genre.Name;
            genre.Slug = updated.Slug ?? genre.Slug;

            await _context.SaveChangesAsync();
            return Ok(genre);
        }

        // DELETE: api/admin/genres/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var genre = await _context.Genres.FindAsync(id);
            if (genre == null) return NotFound($"Genre '{id}' not found");

            _context.Genres.Remove(genre);
            await _context.SaveChangesAsync();
            return Ok($"Genre '{genre.Name}' deleted");
        }

        // POST: api/admin/genres/assign — Gán thể loại vào phim
        [HttpPost("assign")]
        public async Task<IActionResult> AssignToMovie([FromBody] MovieGenre movieGenre)
        {
            var exists = await _context.MovieGenres
                .AnyAsync(mg => mg.MovieId == movieGenre.MovieId && mg.GenreId == movieGenre.GenreId);

            if (exists) return Conflict("This genre is already assigned to this movie");

            _context.MovieGenres.Add(movieGenre);
            await _context.SaveChangesAsync();
            return Ok("Genre assigned to movie");
        }

        // DELETE: api/admin/genres/assign — Bỏ thể loại khỏi phim
        [HttpDelete("assign")]
        public async Task<IActionResult> RemoveFromMovie([FromBody] MovieGenre movieGenre)
        {
            var mg = await _context.MovieGenres
                .FirstOrDefaultAsync(x => x.MovieId == movieGenre.MovieId && x.GenreId == movieGenre.GenreId);

            if (mg == null) return NotFound("Assignment not found");

            _context.MovieGenres.Remove(mg);
            await _context.SaveChangesAsync();
            return Ok("Genre removed from movie");
        }
    }
}
