using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using System.Reflection;
using System.Text.Json;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/system")]
    public class SystemAdminController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SystemAdminController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var stats = new Dictionary<string, int>();
            var properties = typeof(AppDbContext).GetProperties()
                .Where(p => p.PropertyType.IsGenericType && p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>));

            foreach (var prop in properties)
            {
                var dbSet = prop.GetValue(_context) as IQueryable<object>;
                if (dbSet != null) stats[prop.Name] = await dbSet.CountAsync();
            }
            return Ok(stats);
        }

        // POST: Thêm mới bản ghi generic
        [HttpPost("tables/{tableName}")]
        public async Task<IActionResult> CreateRow(string tableName, [FromBody] JsonElement body)
        {
            var property = typeof(AppDbContext).GetProperty(tableName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (property == null) return NotFound($"Bảng {tableName} không tồn tại");

            var entityType = property.PropertyType.GetGenericArguments()[0];

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var entity = JsonSerializer.Deserialize(body.GetRawText(), entityType, options);
            if (entity == null) return BadRequest("Không thể parse dữ liệu");

            _context.Add(entity);
            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpGet("tables/{tableName}")]
        public async Task<IActionResult> GetTableData(string tableName, [FromQuery] bool isDeleted = false)
        {
            var property = typeof(AppDbContext).GetProperty(tableName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (property == null) return NotFound($"Bảng {tableName} không tồn tại");

            var entityType = property.PropertyType.GetGenericArguments()[0];
            var method = typeof(DbContext).GetMethod("Set", Type.EmptyTypes)!.MakeGenericMethod(entityType);
            var dbSet = method.Invoke(_context, null) as IQueryable<object>;

            if (dbSet == null) return NotFound();

            var allData = await dbSet.AsNoTracking().ToListAsync();

            // Kiểm tra xem Entity có hỗ trợ ISoftDelete không
            bool supportsSoftDelete = allData.Any() && allData[0] is ISoftDelete;

            if (supportsSoftDelete)
            {
                // Lọc theo isDeleted nhưng GIỮ NGUYÊN kiểu object gốc để serialize đầy đủ
                var filtered = allData.Where(x => ((ISoftDelete)x).IsDeleted == isDeleted).ToList();
                return Ok(filtered);
            }

            // Bảng không hỗ trợ xóa mềm → chỉ trả về dữ liệu khi xem tab Active
            if (isDeleted) return Ok(new List<object>());

            return Ok(allData);
        }

        [HttpDelete("tables/{tableName}/{id}")]
        public async Task<IActionResult> DeleteRow(string tableName, string id)
        {
            try {
                var property = typeof(AppDbContext).GetProperty(tableName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
                if (property == null) return NotFound();

                var entityType = property.PropertyType.GetGenericArguments()[0];
                var keyProperty = _context.Model.FindEntityType(entityType)?.FindPrimaryKey()?.Properties.FirstOrDefault();
                if (keyProperty == null) return NotFound();

                object? parsedId = null;
                if (keyProperty.ClrType == typeof(int) && int.TryParse(id, out int intId)) {
                    parsedId = intId;
                } else if (keyProperty.ClrType == typeof(Guid) && Guid.TryParse(id, out Guid guidId)) {
                    parsedId = guidId;
                } else if (keyProperty.ClrType == typeof(string)) {
                    parsedId = id;
                } else {
                    return BadRequest("Unsupported key type");
                }

                var entity = await _context.FindAsync(entityType, parsedId);

                if (entity == null) return NotFound();

                // Thực hiện Xóa mềm nếu thực thể hỗ trợ ISoftDelete
                if (entity is ISoftDelete softDeleteEntity)
                {
                    softDeleteEntity.IsDeleted = true;
                    _context.Update(softDeleteEntity);
                }
                else
                {
                    // Nếu bảng không hỗ trợ xóa mềm, xóa vĩnh viễn
                    _context.Remove(entity);
                }

                await _context.SaveChangesAsync();
                return Ok();
            } catch (Exception ex) {
                return StatusCode(500, new { error = ex.Message, inner = ex.InnerException?.Message, stack = ex.StackTrace });
            }
        }

        // API Xóa vĩnh viễn — Chỉ dùng khi đang ở Tab Thùng rác
        [HttpDelete("tables/{tableName}/{id}/force")]
        public async Task<IActionResult> ForceDeleteRow(string tableName, string id)
        {
            var property = typeof(AppDbContext).GetProperty(tableName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (property == null) return NotFound();

            var entityType = property.PropertyType.GetGenericArguments()[0];
            var keyProperty = _context.Model.FindEntityType(entityType)?.FindPrimaryKey()?.Properties.FirstOrDefault();
            if (keyProperty == null) return NotFound();

            object? parsedId = null;
            if (keyProperty.ClrType == typeof(int) && int.TryParse(id, out int intIdForce)) {
                parsedId = intIdForce;
            } else if (keyProperty.ClrType == typeof(Guid) && Guid.TryParse(id, out Guid guidIdForce)) {
                parsedId = guidIdForce;
            } else if (keyProperty.ClrType == typeof(string)) {
                parsedId = id;
            } else {
                return BadRequest("Unsupported key type");
            }

            var entity = await _context.FindAsync(entityType, parsedId);

            if (entity == null) return NotFound();

            _context.Remove(entity);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpPost("tables/{tableName}/{id}/restore")]
        public async Task<IActionResult> RestoreRow(string tableName, string id)
        {
            // Dùng cùng cách tìm entity như DeleteRow (qua tên DbSet property)
            var property = typeof(AppDbContext).GetProperty(tableName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (property == null) return NotFound($"Bảng {tableName} không tồn tại");

            var entityType = property.PropertyType.GetGenericArguments()[0];
            var keyProperty = _context.Model.FindEntityType(entityType)?.FindPrimaryKey()?.Properties.FirstOrDefault();
            if (keyProperty == null) return NotFound();

            object? parsedId = null;
            if (keyProperty.ClrType == typeof(int) && int.TryParse(id, out int intIdRestore)) {
                parsedId = intIdRestore;
            } else if (keyProperty.ClrType == typeof(Guid) && Guid.TryParse(id, out Guid guidIdRestore)) {
                parsedId = guidIdRestore;
            } else if (keyProperty.ClrType == typeof(string)) {
                parsedId = id;
            } else {
                return BadRequest("Unsupported key type");
            }

            var entity = await _context.FindAsync(entityType, parsedId);

            if (entity == null) return NotFound($"Không tìm thấy bản ghi id={id}");

            if (entity is ISoftDelete softDeleteEntity)
            {
                softDeleteEntity.IsDeleted = false;
                _context.Update(entity);
                await _context.SaveChangesAsync();
                return Ok();
            }

            return BadRequest("Bảng này không hỗ trợ khôi phục (không có ISoftDelete)");
        }
    }
}
