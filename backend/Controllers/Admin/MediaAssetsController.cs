using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using ProjectTviEn.Services;
using StackExchange.Redis;

namespace ProjectTviEn.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/media-assets")]
    public class MediaAssetsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IR2Service _r2Service;
        private readonly IConnectionMultiplexer? _redis;

        public MediaAssetsController(AppDbContext context, IR2Service r2Service, IConnectionMultiplexer? redis = null)
        {
            _context = context;
            _r2Service = r2Service;
            _redis = redis;
        }

        [HttpPost("upload")]
        [RequestSizeLimit(2000000000)] // 2GB
        [Consumes("multipart/form-data")] // ✅ Bắt buộc để Swashbuckle generate đúng
        public async Task<IActionResult> UploadMedia([FromForm] UploadMediaRequest request)
        {
            var file = request.File;
            if (file == null || file.Length == 0)
                return BadRequest("Lỗi: Không tìm thấy file.");

            if (!int.TryParse(request.MovieId, out int movieIntId))
                return BadRequest($"Lỗi: MovieId '{request.MovieId}' không hợp lệ.");

            Guid? episodeGuid = null;
            if (!string.IsNullOrEmpty(request.EpisodeId) && Guid.TryParse(request.EpisodeId, out Guid eGuid))
                episodeGuid = eGuid;

            // ============================================================
            // 🛡️ CHẶN UPLOAD VIDEO VÀO ROOT CỦA SERIES
            // Dùng movie.Type thay vì query Seasons — chính xác và nhanh hơn.
            // ============================================================
            if (request.AssetType == "MainVideo" || request.AssetType == "Video luồng chính")
            {
                var movie = await _context.Movies.FindAsync(movieIntId);
                if (movie != null && movie.Type == MovieType.TvSeries && episodeGuid == null)
                {
                    return BadRequest(
                        "LỖI KIẾN TRÚC: Phim này là Series (TvSeries). " +
                        "Bạn KHÔNG THỂ tải video trực tiếp vào gốc phim bộ. " +
                        "Hãy vào quản lý 'Tập Phim' (Episodes) và chọn đúng Tập để tải video lên!");
                }
            }


            try
            {
                // 1. Upload file thô lên R2
                var key = $"raw/{request.MovieId}/{Guid.NewGuid():N}_{file.FileName}";
                using var stream = file.OpenReadStream();
                var uploadSuccess = await _r2Service.UploadFileAsync(key, stream, file.ContentType);
                if (!uploadSuccess) return StatusCode(500, "Lỗi: Upload lên R2 thất bại.");


                // 2. Lưu MediaAsset vào DB
                var asset = new MediaAsset
                {
                    AssetId = Guid.NewGuid().ToString("N"),
                    MovieId = movieIntId,
                    EpisodeId = episodeGuid,
                    Path = key,
                    Type = request.AssetType,
                    CreatedAt = DateTime.UtcNow
                };
                _context.MediaAssets.Add(asset);

                // 3. Tạo IngestJob + Push vào Redis Queue để Worker xử lý
                if (request.AutoIngest && (request.AssetType == "MainVideo" || request.AssetType == "Video luồng chính"))
                {
                    var job = new IngestJob
                    {
                        JobId = Guid.NewGuid().ToString("N"),
                        MovieId = movieIntId,
                        EpisodeId = episodeGuid,
                        RawPath = key,
                        Status = "pending",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.IngestJobs.Add(job);
                    await _context.SaveChangesAsync();

                    // ✅ Push JobId vào Redis Queue (nếu Redis sẵn sàng)
                    try
                    {
                        if (_redis != null && _redis.IsConnected)
                        {
                            var db = _redis.GetDatabase();
                            await db.ListLeftPushAsync("tvien:ingest_queue", job.JobId);
                        }
                        else
                        {
                            Console.WriteLine($"[WARN] Redis không kết nối - Job {job.JobId} đã lưu DB nhưng chưa push queue.");
                        }
                    }
                    catch (Exception redisEx)
                    {
                        Console.WriteLine($"[WARN] Redis push lỗi: {redisEx.Message}. Job vẫn được lưu.");
                    }

                    return Ok(new { asset, job });
                }

                await _context.SaveChangesAsync();
                return Ok(asset);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi hệ thống: {ex.Message}");
            }
        }
    }
}
