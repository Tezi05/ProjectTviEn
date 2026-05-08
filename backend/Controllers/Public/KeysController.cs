using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Controllers.Public
{
    [ApiController]
    [Route("api/public/keys")]
    public class KeysController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ILogger<KeysController> _logger;

        // Danh sách domain hợp lệ được phép lấy chìa khóa
        private static readonly string[] AllowedOrigins = new[]
        {
            "localhost",
            "tvien.com",  // Thay bằng domain thật của bạn
            "vercel.app",
            "onrender.com"
        };

        public KeysController(AppDbContext db, ILogger<KeysController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// API "Gác cổng" - Trả về AES-128 Key để giải mã video HLS.
        /// Chặn IDM, UC Browser, Cốc Cốc bằng cách kiểm tra Referer header.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetVideoKey(string id)
        {
            // --- BƯỚC 1: Chặn kẻ tải lậu bằng cách soi Referer ---
            var referer = Request.Headers["Referer"].ToString();
            
            if (!string.IsNullOrEmpty(referer)){
                bool isAllowedOrigin = AllowedOrigins.Any(origin => referer.Contains(origin));
                if (!isAllowedOrigin){
                    _logger.LogWarning("[🚫] Chặn yêu cầu lấy key từ nguồn không rõ danh tính: {Referer}", referer);
                    return StatusCode(403, "Cấm tải lậu. Vui lòng xem phim trực tiếp trên website.");
                }
            }

            // --- BƯỚC 2: Mở két sắt Database lấy chìa khóa ---
            Video? video = null;

            if (Guid.TryParse(id, out Guid videoGuid))
            {
                // 1. Thử tìm trực tiếp theo VideoId (Guid)
                video = await _db.Videos.FindAsync(videoGuid);

                // 2. Nếu không thấy, thử xem đây có phải là JobId không
                if (video == null)
                {
                    var job = await _db.IngestJobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobId == id);
                    if (job != null)
                    {
                        if (job.EpisodeId.HasValue)
                            video = await _db.Videos.FirstOrDefaultAsync(v => v.EpisodeId == job.EpisodeId && !v.IsDeleted);
                        else
                            video = await _db.Videos.FirstOrDefaultAsync(v => v.MovieId == job.MovieId && v.EpisodeId == null && !v.IsDeleted);
                    }
                }
            }
            
            // 3. Nếu vẫn không thấy hoặc không phải Guid, thử tìm theo MovieId (int)
            if (video == null && int.TryParse(id, out int movieId))
            {
                video = await _db.Videos.FirstOrDefaultAsync(v => v.MovieId == movieId && !v.IsDeleted);
            }

            if (video == null || string.IsNullOrEmpty(video.EncryptionKey)){
                _logger.LogWarning("[!] Không tìm thấy EncryptionKey cho ID {Id}", id);
                return NotFound("Không tìm thấy khóa cho video này.");
            }

            // --- BƯỚC 3: Trả chìa khóa về cho trình phát HLS (dạng nhị phân) ---
            try 
            {
                byte[] keyBytes = Convert.FromBase64String(video.EncryptionKey);
                _logger.LogInformation("[🔑] Cấp khóa giải mã cho video: {VideoId}", video.VideoId);
                return File(keyBytes, "application/octet-stream");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi convert EncryptionKey từ Base64");
                return StatusCode(500, "Lỗi định dạng khóa.");
            }
        }
    }
}
