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
        [HttpGet("{movieId}")]
        public async Task<IActionResult> GetMovieKey(string movieId){
            // --- BƯỚC 1: Chặn kẻ tải lậu bằng cách soi Referer ---
            var referer = Request.Headers["Referer"].ToString();
            
            if (!string.IsNullOrEmpty(referer)){
                bool isAllowedOrigin = AllowedOrigins.Any(origin => referer.Contains(origin));
                if (!isAllowedOrigin){
                    _logger.LogWarning("[🚫] Chặn yêu cầu lấy key từ nguồn không rõ danh tính: {Referer}", referer);
                    return StatusCode(403, "Cấm tải lậu. Vui lòng xem phim trực tiếp trên website.");
                }
            }

            // --- BƯỚC 2: Mở két sắt Database lấy chìa khóa của phim ---
            var movie = await _db.Movies.FindAsync(movieId);

            if (movie == null || string.IsNullOrEmpty(movie.EncryptionKey)){
                _logger.LogWarning("[!] Không tìm thấy EncryptionKey cho phim {MovieId}", movieId);
                return NotFound("Không tìm thấy khóa cho bộ phim này.");
            }

            // --- BƯỚC 3: Trả chìa khóa về cho trình phát HLS (dạng nhị phân) ---
            byte[] keyBytes = Convert.FromBase64String(movie.EncryptionKey);
            
            _logger.LogInformation("[🔑] Cấp khóa giải mã cho phim: {MovieId}", movieId);
            
            // Bắt buộc trả về dạng octet-stream thì HLS.js mới hiểu đây là file Key
            return File(keyBytes, "application/octet-stream");
        }
    }
}
