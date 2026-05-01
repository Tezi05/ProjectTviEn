using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Amazon.S3;
using Amazon.S3.Transfer;
using System.Diagnostics;
using System.Text;
using StackExchange.Redis;

Console.WriteLine("╔══════════════════════════════════════╗");
Console.WriteLine("║     TVIEN INGEST WORKER v2.0         ║");
Console.WriteLine("╚══════════════════════════════════════╝");

var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json")
    .Build();

var connectionString   = configuration.GetConnectionString("DefaultConnection");
var redisConnectionStr = configuration.GetConnectionString("Redis") ?? "localhost:6379";
var ffmpegCodec        = configuration["FFmpegConfig:VideoCodec"] ?? "libx264";
var ffmpegThreads      = configuration["FFmpegConfig:Threads"]    ?? "2";
var ffmpegPreset       = configuration["FFmpegConfig:Preset"]     ?? "ultrafast";
var ffmpegHlsTime      = configuration["FFmpegConfig:HlsTime"]    ?? "10";

// ✅ Thư mục temp linh hoạt: ưu tiên config, fallback về thư mục hệ thống
var tempRoot = configuration["WorkerConfig:TempFolder"]
    ?? Path.Combine(Path.GetTempPath(), "tvien_worker");

Console.WriteLine($"[📂] Temp folder: {tempRoot}");
Console.WriteLine($"[🔗] DB: {connectionString?.Split(';').FirstOrDefault(s => s.StartsWith("Database"))}");
Console.WriteLine($"[🎬] FFmpeg: codec={ffmpegCodec}, preset={ffmpegPreset}, threads={ffmpegThreads}");

var qualities = new[]
{
    new { Name = "480p",  Scale = "854:480",   Crf = "23", Audio = "96k",  Bandwidth = "800000"  },
    new { Name = "720p",  Scale = "1280:720",  Crf = "22", Audio = "128k", Bandwidth = "2500000" },
    new { Name = "1080p", Scale = "1920:1080", Crf = "21", Audio = "192k", Bandwidth = "5000000" },
};

var r2Config   = new AmazonS3Config { ServiceURL = configuration["R2:Endpoint"], ForcePathStyle = true, SignatureVersion = "4", AuthenticationRegion = "auto" };
var s3Client   = new AmazonS3Client(configuration["R2:AccessKey"], configuration["R2:SecretKey"], r2Config);
var bucketName = configuration["R2:BucketName"] ?? "";

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseNpgsql(connectionString);

Console.WriteLine("[🔌] Đang kết nối Redis...");
var redisMux = ConnectionMultiplexer.Connect(redisConnectionStr + ",abortConnect=false");
var dbRedis  = redisMux.GetDatabase();
Console.WriteLine("[✅] Redis OK! Đang lắng nghe queue 'tvien:ingest_queue'...\n");

while (true)
{
    try
    {
        // Chờ và lấy job từ Redis queue (blocking pop)
        var queueVal = await dbRedis.ListRightPopAsync("tvien:ingest_queue");
        if (!queueVal.HasValue) { await Task.Delay(3000); continue; }

        string currentJobId = queueVal.ToString();
        using var db = new AppDbContext(optionsBuilder.Options);
        var job = await db.IngestJobs.FirstOrDefaultAsync(j => j.JobId == currentJobId);
        if (job == null) 
        {
            Console.WriteLine($"[⚠️] Không tìm thấy Job ID: {currentJobId}");
            continue;
        }

        Console.WriteLine($"\n{'─',40}");
        Console.WriteLine($"[🚀] BẮT ĐẦU JOB: {job.JobId}");
        Console.WriteLine($"[🎬] Movie: {job.MovieId} | Episode: {job.EpisodeId?.ToString() ?? "N/A (phim lẻ)"}");
        Console.WriteLine($"[📁] File thô: {job.RawPath}");

        job.Status    = "processing";
        job.StartedAt = DateTime.UtcNow;
        job.Attempts++;
        await db.SaveChangesAsync();

        // Helper: cập nhật tiến độ vào Redis (để Admin Dashboard có thể poll)
        var reportProgress = async (string status, int percent, string detail) =>
        {
            var payload = $"{{\"status\":\"{status}\",\"percent\":{percent},\"detail\":\"{detail}\",\"jobId\":\"{job.JobId}\"}}";
            await dbRedis.StringSetAsync($"job:progress:{job.JobId}", payload, TimeSpan.FromDays(1));
            // Cũng ghi theo MovieId để frontend dễ query
            await dbRedis.StringSetAsync($"job:progress:movie:{job.MovieId}", payload, TimeSpan.FromDays(1));
            Console.WriteLine($"[📊] {percent,3}% | {detail}");
        };

        // Xác định R2 prefix cho output HLS — khớp với GatekeeperController
        string hlsR2Prefix = job.EpisodeId.HasValue
            ? $"stream/ep_{job.EpisodeId}/"
            : $"stream/{job.MovieId}/";

        // Tạo thư mục temp cho job này
        string tempFolder = Path.Combine(tempRoot, job.JobId);
        Directory.CreateDirectory(tempFolder);
        string inputPath = Path.Combine(tempFolder, "input.mp4");

        await reportProgress("processing", 5, "Đang tải file thô từ R2...");
        await new TransferUtility(s3Client).DownloadAsync(inputPath, bucketName, job.RawPath);
        Console.WriteLine($"[📥] Tải xong: {new FileInfo(inputPath).Length / (1024 * 1024)}MB");

        string hlsFolder = Path.Combine(tempFolder, "hls");
        Directory.CreateDirectory(hlsFolder);

        // Tạo khóa mã hóa AES-128
        byte[] keyBytes = new byte[16];
        System.Security.Cryptography.RandomNumberGenerator.Fill(keyBytes);
        string encKeyBase64 = Convert.ToBase64String(keyBytes);

        await reportProgress("processing", 10, "Đang chạy FFmpeg...");

        var qualityConfigs = qualities.Select(q => new QualityConfig
        {
            Name = q.Name, Scale = q.Scale, Crf = q.Crf,
            Audio = q.Audio, Bandwidth = q.Bandwidth
        }).ToArray();

        bool success = await RunFFmpeg(inputPath, hlsFolder, currentJobId, keyBytes, 
            ffmpegCodec, ffmpegThreads, ffmpegPreset, ffmpegHlsTime, qualityConfigs, reportProgress);

        if (success)
        {
            await reportProgress("processing", 85, "FFmpeg xong! Đang tạo master playlist...");

            // Tạo master.m3u8
            string masterPath = Path.Combine(hlsFolder, "master.m3u8");
            var sb = new StringBuilder("#EXTM3U\n#EXT-X-VERSION:3\n");
            foreach (var q in qualities)
            {
                sb.AppendLine($"#EXT-X-STREAM-INF:BANDWIDTH={q.Bandwidth},RESOLUTION={q.Scale.Replace(":", "x")}");
                sb.AppendLine($"{q.Name}/index.m3u8");
            }
            await File.WriteAllTextAsync(masterPath, sb.ToString());

            await reportProgress("processing", 90, "Đang upload HLS lên R2...");
            await UploadFolderToR2(s3Client, bucketName, hlsFolder, hlsR2Prefix);

            string masterPlaylistUrl = $"{hlsR2Prefix}master.m3u8";

            // Tìm Video record cũ (nếu đang cập nhật lại)
            Video? existingVideo;
            if (job.EpisodeId.HasValue)
                existingVideo = await db.Videos.FirstOrDefaultAsync(v => v.EpisodeId == job.EpisodeId && !v.IsDeleted);
            else
                existingVideo = await db.Videos.FirstOrDefaultAsync(v => v.MovieId == job.MovieId && v.EpisodeId == null && !v.IsDeleted);

            if (existingVideo == null)
            {
                // ✅ Tạo Video record mới
                db.Videos.Add(new Video
                {
                    VideoId           = Guid.NewGuid(),
                    MovieId           = job.EpisodeId.HasValue ? null : job.MovieId,
                    EpisodeId         = job.EpisodeId,
                    Resolution        = "multi",
                    MasterPlaylistUrl = masterPlaylistUrl,
                    IsEncrypted       = true,
                    EncryptionKey     = encKeyBase64,
                    CreatedAt         = DateTime.UtcNow
                });
            }
            else
            {
                // Cập nhật Video record cũ
                existingVideo.MasterPlaylistUrl = masterPlaylistUrl;
                existingVideo.EncryptionKey     = encKeyBase64;
                existingVideo.IsEncrypted       = true;
                existingVideo.UpdatedAt         = DateTime.UtcNow;
            }

            job.Status     = "done";
            job.FinishedAt = DateTime.UtcNow;
            job.Logs       = $"Hoàn tất. Output: {masterPlaylistUrl}";
            await db.SaveChangesAsync();

            await reportProgress("done", 100, $"✅ Hoàn tất! HLS tại: {masterPlaylistUrl}");
            Console.WriteLine($"[✅] JOB HOÀN THÀNH: {job.JobId}");
        }
        else
        {
            job.Status     = "failed";
            job.FinishedAt = DateTime.UtcNow;
            job.Logs       = "FFmpeg thất bại. Xem log console để biết chi tiết.";
            await db.SaveChangesAsync();
            await reportProgress("failed", 0, "❌ FFmpeg thất bại!");
            Console.WriteLine($"[❌] JOB THẤT BẠI: {job.JobId}");
        }

        // Dọn dẹp temp
        try { Directory.Delete(tempFolder, true); Console.WriteLine("[🗑️] Đã xóa temp folder."); } catch { }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[🔥] LỖI NGHIÊM TRỌNG: {ex.Message}");
        if (ex.InnerException != null) Console.WriteLine($"      Inner: {ex.InnerException.Message}");
        await Task.Delay(5000); // Chờ 5s trước khi thử job tiếp theo
    }
}

// ════════════════════════════════════════
// HÀM CHẠY FFMPEG
// ════════════════════════════════════════
async Task<bool> RunFFmpeg(
    string inputPath, string hlsFolder, string jobId, byte[] keyBytes,
    string codec, string threads, string preset, string hlsTime,
    QualityConfig[] qualityConfigs,
    Func<string, int, string, Task> reportProgress)
{
    try
    {
        // Tạo file khóa AES
        string keyFile     = Path.Combine(hlsFolder, "enc.key");
        string keyInfoFile = Path.Combine(hlsFolder, "enc.keyinfo");
        await File.WriteAllBytesAsync(keyFile, keyBytes);
        string keyApiUrl = $"http://localhost:5113/api/public/keys/{jobId}";
        await File.WriteAllTextAsync(keyInfoFile, $"{keyApiUrl}\n{keyFile}\n");

        var args = new StringBuilder($"-threads {threads} -y -i \"{inputPath}\" ");
        foreach (var q in qualityConfigs)
        {
            Directory.CreateDirectory(Path.Combine(hlsFolder, q.Name));
            args.Append($"-map 0:v:0 -map 0:a:0 ");
            args.Append($"-vf scale={q.Scale} -c:v {codec} -crf {q.Crf} -preset {preset} ");
            args.Append($"-c:a aac -b:a {q.Audio} ");
            args.Append($"-hls_time {hlsTime} -hls_list_size 0 ");
            args.Append($"-hls_key_info_file \"{keyInfoFile}\" ");
            args.Append($"-hls_segment_filename \"{hlsFolder}/{q.Name}/seg%03d.ts\" ");
            args.Append($"\"{hlsFolder}/{q.Name}/index.m3u8\" ");
        }

        Console.WriteLine($"[🎬] FFmpeg args: {args}");

        var psi = new ProcessStartInfo
        {
            FileName               = "ffmpeg",
            Arguments              = args.ToString(),
            UseShellExecute        = false,
            RedirectStandardError  = true,
            CreateNoWindow         = true
        };

        var process = Process.Start(psi)!;
        
        // Đọc stderr của FFmpeg để cập nhật tiến độ
        _ = Task.Run(async () =>
        {
            while (!process.StandardError.EndOfStream)
            {
                var line = await process.StandardError.ReadLineAsync();
                if (line != null && line.Contains("time="))
                    Console.WriteLine($"  ffmpeg: {line.Trim()}");
            }
        });

        await process.WaitForExitAsync();
        await reportProgress("processing", 80, $"FFmpeg kết thúc (exit code: {process.ExitCode})");
        return process.ExitCode == 0;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[❌] FFmpeg exception: {ex.Message}");
        return false;
    }
}

// ════════════════════════════════════════
// UPLOAD THƯ MỤC LÊN R2
// ════════════════════════════════════════
async Task UploadFolderToR2(IAmazonS3 client, string bucket, string localFolder, string r2Prefix)
{
    var files = Directory.GetFiles(localFolder, "*.*", SearchOption.AllDirectories);
    int uploaded = 0;
    foreach (var file in files)
    {
        if (file.EndsWith(".key") || file.EndsWith(".keyinfo")) continue;
        string r2Key = r2Prefix + Path.GetRelativePath(localFolder, file).Replace("\\", "/");
        await client.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest
        {
            BucketName           = bucket,
            Key                  = r2Key,
            FilePath             = file,
            DisablePayloadSigning = true  // ✅ Bắt buộc cho Cloudflare R2
        });
        uploaded++;
        Console.WriteLine($"  ↑ [{uploaded}/{files.Length - 2}] {r2Key}");
    }
}

record QualityConfig
{
    public string Name      { get; init; } = "";
    public string Scale     { get; init; } = "";
    public string Crf       { get; init; } = "23";
    public string Audio     { get; init; } = "128k";
    public string Bandwidth { get; init; } = "1000000";
}
