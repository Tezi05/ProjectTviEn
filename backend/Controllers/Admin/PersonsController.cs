using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/persons")]
    public class PersonsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PersonsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/persons
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var persons = await _context.Persons
                .OrderBy(p => p.FullName)
                .Select(p => new { p.PersonId, p.FullName, p.Slug, p.Nationality, p.ProfilePhotoUrl, p.BirthDate })
                .ToListAsync();
            return Ok(persons);
        }

        // GET: api/admin/persons/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var person = await _context.Persons
                .Include(p => p.MovieCrews)
                    .ThenInclude(mc => mc.Movie)
                .FirstOrDefaultAsync(p => p.PersonId == id);

            if (person == null) return NotFound($"Person '{id}' not found");
            return Ok(person);
        }

        // POST: api/admin/persons
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Person person)
        {
            if (string.IsNullOrEmpty(person.FullName))
                return BadRequest("FullName is required");

            person.CreatedAt = DateTime.UtcNow;
            _context.Persons.Add(person);
            await _context.SaveChangesAsync();
            return Ok(person);
        }

        // PUT: api/admin/persons/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Person updated)
        {
            var person = await _context.Persons.FindAsync(id);
            if (person == null) return NotFound($"Person '{id}' not found");

            person.FullName        = updated.FullName ?? person.FullName;
            person.Slug            = updated.Slug ?? person.Slug;
            person.Biography       = updated.Biography ?? person.Biography;
            person.ProfilePhotoUrl = updated.ProfilePhotoUrl ?? person.ProfilePhotoUrl;
            person.BirthDate       = updated.BirthDate ?? person.BirthDate;
            person.Nationality     = updated.Nationality ?? person.Nationality;

            await _context.SaveChangesAsync();
            return Ok(person);
        }

        // DELETE: api/admin/persons/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var person = await _context.Persons.FindAsync(id);
            if (person == null) return NotFound($"Person '{id}' not found");

            _context.Persons.Remove(person);
            await _context.SaveChangesAsync();
            return Ok($"Person '{person.FullName}' deleted");
        }
    }
}
