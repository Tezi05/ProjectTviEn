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
                .Select(p => new { p.Id, p.FullName, p.Slug, p.Nationality, p.AvatarUrl, p.Dob })
                .ToListAsync();
            return Ok(persons);
        }

        // GET: api/admin/persons/search?keyword=tran&limit=10
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string keyword = "", [FromQuery] int limit = 10)
        {
            var q = _context.Persons.Where(p => !p.IsDeleted);
            if (!string.IsNullOrWhiteSpace(keyword))
                q = q.Where(p => p.FullName.ToLower().Contains(keyword.ToLower()) || 
                                 (p.Nationality != null && p.Nationality.ToLower().Contains(keyword.ToLower())));
            var results = await q
                .OrderBy(p => p.FullName)
                .Take(limit)
                .Select(p => new { p.Id, p.FullName, p.AvatarUrl, p.Nationality, p.Dob })
                .ToListAsync();
            return Ok(results);
        }

        // GET: api/admin/persons/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var person = await _context.Persons
                .Include(p => p.MovieCrews)
                    .ThenInclude(mc => mc.Movie)
                .FirstOrDefaultAsync(p => p.Id == id);

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
            person.AvatarUrl       = updated.AvatarUrl ?? person.AvatarUrl;
            person.Dob             = updated.Dob ?? person.Dob;
            person.Nationality     = updated.Nationality ?? person.Nationality;
            person.Gender          = updated.Gender ?? person.Gender;

            await _context.SaveChangesAsync();
            return Ok(person);
        }

        // DELETE: api/admin/persons/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var person = await _context.Persons.FindAsync(id);
            if (person == null) return NotFound($"Person '{id}' not found");

            person.IsDeleted = true;
            _context.Update(person);
            await _context.SaveChangesAsync();
            return Ok($"Person '{person.FullName}' hidden (soft-deleted)");
        }
    }
}
