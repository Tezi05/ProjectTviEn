using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/crew")]
    public class MovieCrewController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MovieCrewController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/crew?movieId=xxx
        [HttpGet]
        public async Task<IActionResult> GetByMovie([FromQuery] string movieId)
        {
            var crew = await _context.MovieCrews
                .Where(mc => mc.MovieId == movieId)
                .Include(mc => mc.Person)
                .Select(mc => new {
                    mc.Id,
                    mc.Role,
                    mc.CharacterName,
                    Person = new { mc.Person.Id, mc.Person.FullName, AvatarUrl = mc.Person.AvatarUrl }
                })
                .ToListAsync();
            return Ok(crew);
        }

        // POST: api/admin/crew — Thêm người vào phim
        [HttpPost]
        public async Task<IActionResult> Add([FromBody] MovieCrew crew)
        {
            if (string.IsNullOrEmpty(crew.MovieId) || string.IsNullOrEmpty(crew.PersonId))
                return BadRequest("MovieId and PersonId are required");

            _context.MovieCrews.Add(crew);
            await _context.SaveChangesAsync();
            return Ok(crew);
        }

        // DELETE: api/admin/crew/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Remove(int id)
        {
            var crew = await _context.MovieCrews.FindAsync(id);
            if (crew == null) return NotFound($"Crew entry '{id}' not found");

            _context.MovieCrews.Remove(crew);
            await _context.SaveChangesAsync();
            return Ok("Crew member removed from movie");
        }
    }
}
