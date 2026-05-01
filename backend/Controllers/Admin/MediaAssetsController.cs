using Microsoft.AspNetCore.Mvc;
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
        private readonly IConnectionMultiplexer _redis;

        public MediaAssetsController(AppDbContext context, IR2Service r2Service, IConnectionMultiplexer redis)
        {
            _context = context;
            _r2Service = r2Service;
            _redis = redis;
        }

        [HttpPost("upload")]
        [RequestSizeLimit(2000000000)] // 2GB
        public async Task<IActionResult> UploadMedia(
            [FromForm] IFormFile file,
            [FromForm] string movieId,
            [FromForm] string assetType,
            [FromForm] bool autoIngest,
            [FromForm] string? episodeId = null)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Lỗi: Không tìm thấy file.");

            if (!int.TryParse(movieId, out int movieIntId))
                return BadRequest($"Lỗi: MovieId '{movieId}' không hợp lệ.");

            Guid? episodeGuid = null;
            if (!string.IsNullOrEmpty(episodeId) && Guid.TryParse(episodeId, out Guid eGuid))
                episodeGuid = eGuid;

            try
            {
                // 1. Upload file thô lên R2
                var key = $"raw/{movieId}/{Guid.NewGuid():N}_{file.FileName}";
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
                    Type = assetType,
                    CreatedAt = DateTime.UtcNow
                };
                _context.MediaAssets.Add(asset);

                // 3. Tạo IngestJob + Push vào Redis Queue để Worker xử lý
                if (autoIngest && (assetType == "MainVideo" || assetType == "Video luồng chính"))
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

                    // ✅ Push JobId vào Redis Queue để Worker nhận và xử lý
                    var db = _redis.GetDatabase();
                    await db.ListLeftPushAsync("tvien:ingest_queue", job.JobId);

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
