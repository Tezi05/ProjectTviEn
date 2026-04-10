using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/users")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/admin/users
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var users = await _context.Users
                .Include(u => u.Role)
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new {
                    u.UserId, u.Email, u.DisplayName, u.AvatarUrl,
                    Role = u.Role.Name, u.IsActive, u.VipExpiresAt, u.CreatedAt
                })
                .ToListAsync();

            var total = await _context.Users.CountAsync();
            return Ok(new { total, page, pageSize, users });
        }

        // GET: api/admin/users/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null) return NotFound($"User '{id}' not found");
            return Ok(user);
        }

        // PATCH: api/admin/users/{id}/ban
        [HttpPatch("{id}/ban")]
        public async Task<IActionResult> Ban(string id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound($"User '{id}' not found");

            user.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok($"User '{user.Email}' has been banned");
        }

        // PATCH: api/admin/users/{id}/unban
        [HttpPatch("{id}/unban")]
        public async Task<IActionResult> Unban(string id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound($"User '{id}' not found");

            user.IsActive = true;
            await _context.SaveChangesAsync();
            return Ok($"User '{user.Email}' has been unbanned");
        }

        // PATCH: api/admin/users/{id}/role
        [HttpPatch("{id}/role")]
        public async Task<IActionResult> ChangeRole(string id, [FromBody] int roleId)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound($"User '{id}' not found");

            var role = await _context.Roles.FindAsync(roleId);
            if (role == null) return BadRequest("Invalid roleId");

            user.RoleId = roleId;
            await _context.SaveChangesAsync();
            return Ok($"User '{user.Email}' role changed to '{role.Name}'");
        }

        // DELETE: api/admin/users/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound($"User '{id}' not found");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return Ok($"User '{user.Email}' deleted");
        }
    }
}
