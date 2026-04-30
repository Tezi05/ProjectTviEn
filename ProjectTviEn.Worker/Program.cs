using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Amazon.S3;
using Amazon.S3.Transfer;
using System.Diagnostics;
using System.Text;
using Prometheus;
using StackExchange.Redis;

// ============================================================
// 1. KHỞI TẠO CẤU HÌNH
// ============================================================
var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json")
    .Build();

var connectionString    = configuration.GetConnectionString("DefaultConnection");
var redisConnectionStr  = configuration.GetConnectionString("Redis") ?? "localhost:6379";
var ffmpegCodec         = configuration["FFmpegConfig:VideoCodec"] ?? "libx264";
var ffmpegThreads       = configuration["FFmpegConfig:Threads"]    ?? "6";
var ffmpegPreset        = configuration["FFmpegConfig:Preset"]     ?? "fast";
var ffmpegHlsTime       = configuration["FFmpegConfig:HlsTime"]    ?? "6";
var ffmpegCrf           = configuration["FFmpegConfig:Crf"]        ?? "23"; // [MỚI] Thêm CRF

// ============================================================
// 2. ĐỊNH NGHĨA DANH SÁCH RESOLUTION — DỄ MỞ RỘNG
//    Muốn thêm resolution → thêm 1 dòng
//    Muốn bỏ resolution   → comment 1 dòng
// ============================================================
var qualities = new[]
{
    new { Name = "480p",  Scale = "854:480",   Crf = "23", Audio = "96k",  Bandwidth = "800000"  },
    new { Name = "720p",  Scale = "1280:720",  Crf = "22", Audio = "128k", Bandwidth = "2500000" },
    new { Name = "1080p", Scale = "1920:1080", Crf = "21", Audio = "192k", Bandwidth = "5000000" },
};

// ============================================================
// 3. KHỞI TẠO MONITORING, R2, DB, REDIS
// ============================================================
var metricServer = new MetricServer(port: 1234);
metricServer.Start();
Console.WriteLine("[v] Monitoring Server started on port 1234.");

var jobCounter      = Metrics.CreateCounter("worker_jobs_total", "Total jobs processed", new CounterConfiguration { LabelNames = new[] { "status" } });
var ffmpegDuration  = Metrics.CreateHistogram("worker_ffmpeg_duration_seconds", "Duration of FFmpeg transcoding");

var r2Config = new AmazonS3Config
{
    ServiceURL        = configuration["R2:Endpoint"],
    ForcePathStyle    = true,
    SignatureVersion  = "4",
    AuthenticationRegion = "auto"
};
var s3Client   = new AmazonS3Client(configuration["R2:AccessKey"], configuration["R2:SecretKey"], r2Config);
var bucketName = configuration["R2:BucketName"];

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseNpgsql(connectionString);

var redisMux = ConnectionMultiplexer.Connect(redisConnectionStr);
var dbRedis  = redisMux.GetDatabase();

// ============================================================
// 4. ZOMBIE SWEEPER — Dọn dẹp job bị treo khi khởi động
// ============================================================
Console.WriteLine("--- WORKER KHỞI ĐỘNG: TIẾN HÀNH DỌN DẸP (ZOMBIE SWEEPER) ---");
using (var db = new AppDbContext(optionsBuilder.Options))
{
    var twoHoursAgo = DateTime.UtcNow.AddHours(-2);
    var zombies = await db.IngestJobs
        .Where(j => j.Status == "processing" && j.StartedAt < twoHoursAgo)
        .ToListAsync();

    if (zombies.Any())
    {
        Console.WriteLine($"[!] Phát hiện {zombies.Count} zombies. Đang dọn dẹp...");
        foreach (var z in zombies)
        {
            z.Status = "pending";
            string zombieFolder = Path.Combine(@"E:\Data\Project\worker_temp", z.JobId);
            try { if (Directory.Exists(zombieFolder)) Directory.Delete(zombieFolder, true); } catch { }
            await dbRedis.ListLeftPushAsync("tvien:ingest_queue", z.JobId);
            Console.WriteLine($"  -> Đã reset Zombie Job: {z.JobId}");
        }
        await db.SaveChangesAsync();
    }
}

Console.WriteLine("--- WORKER SẴN SÀNG: ĐANG CHỜ PHIM... ---");

// ============================================================
// 5. MAIN LOOP
// ============================================================
while (true)
{
    try
    {
        var queueVal = await dbRedis.ListRightPopAsync("tvien:ingest_queue");
        if (!queueVal.HasValue)
        {
            await Task.Delay(3000);
            continue;
        }

        string currentJobId = queueVal.ToString();

        using var db  = new AppDbContext(optionsBuilder.Options);
        var job        = await db.IngestJobs.FirstOrDefaultAsync(j => j.JobId == currentJobId);
        if (job == null) continue;

        Console.WriteLine($"\n[!] Bắt được phim mới: {job.MovieId}. Bắt đầu xử lý...");

        job.Status    = "processing";
        job.StartedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Helper báo tiến độ lên Redis
        var reportProgress = async (string status, int percent, string detail) =>
        {
            var payload = $"{{\"Status\":\"{status}\", \"Percent\":{percent}, \"Detail\":\"{detail}\"}}";
            await dbRedis.StringSetAsync($"job:progress:{job.MovieId}", payload, TimeSpan.FromDays(1));
        };

        // ── BƯỚC 1: TẢI VIDEO GỐC TỪ R2 ──────────────────────────────
        await reportProgress("processing", 0, "Đang tải video gốc từ R2 xuống máy chủ xử lý...");

        string tempFolder = Path.Combine(@"E:\Data\Project\worker_temp", job.JobId);
        Directory.CreateDirectory(tempFolder);
        string inputPath = Path.Combine(tempFolder, "input.mp4");

        bool downloaded   = false;
        int  maxRetries   = 12;
        int  currentRetry = 0;

        while (currentRetry <= maxRetries && !downloaded)
        {
            try
            {
                await DownloadFileFromR2(s3Client, bucketName, job.RawPath, inputPath);
                downloaded = true;
                Console.WriteLine("[v] Tải thành công!");
            }
            catch (AmazonS3Exception ex) when (ex.ErrorCode == "NoSuchKey")
            {
                currentRetry++;
                if (currentRetry > maxRetries) throw;
                Console.WriteLine($"[!] Phim chưa có trên R2. Đợi... Lần {currentRetry}/{maxRetries}");
                await Task.Delay(5000);
            }
        }

        // ── BƯỚC 2: TRÍCH XUẤT THUMBNAIL & PREVIEW ────────────────────
        string hlsFolder = Path.Combine(tempFolder, "hls");
        Directory.CreateDirectory(hlsFolder);

        await reportProgress("processing", 10, "Đang trích xuất ảnh đại diện và video preview...");
        Console.WriteLine("[+] Đang trích xuất thumbnail và preview...");

        string thumbnailPath = Path.Combine(hlsFolder, "thumbnail.jpg");
        string previewPath   = Path.Combine(hlsFolder, "preview.mp4");

        try
        {
            var movieInfo = await db.Movies.FindAsync(job.MovieId);
            if (movieInfo == null || string.IsNullOrEmpty(movieInfo.PosterUrl))
            {
                var thumbProc = Process.Start(new ProcessStartInfo(
                    "ffmpeg", $"-y -i \"{inputPath}\" -ss 00:00:00.000 -vframes 1 \"{thumbnailPath}\"")
                    { CreateNoWindow = true, UseShellExecute = false });
                await thumbProc!.WaitForExitAsync();
            }
            else
            {
                Console.WriteLine("[i] Phim đã có Custom Poster, bỏ qua bước cắt ảnh.");
            }

            var previewProc = Process.Start(new ProcessStartInfo(
                "ffmpeg", $"-y -i \"{inputPath}\" -t 10 -vf scale=480:-2 -an -c:v libx264 -preset ultrafast -crf 28 \"{previewPath}\"")
                { CreateNoWindow = true, UseShellExecute = false });
            await previewProc!.WaitForExitAsync();

            Console.WriteLine("[v] Trích xuất Public Asset thành công!");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[X] Lỗi tạo Public Asset: {ex.Message}");
        }

        // ── BƯỚC 3: SINH KHÓA AES-128 ─────────────────────────────────
        byte[] globalKeyBytes  = new byte[16];
        System.Security.Cryptography.RandomNumberGenerator.Fill(globalKeyBytes);
        string globalKeyBase64 = Convert.ToBase64String(globalKeyBytes);
        Console.WriteLine($"[🔐] Đã sinh KHÓA AES-128 cho phim {job.MovieId}");

        // ── BƯỚC 4: ENCODE — 1 LỆNH FFMPEG, 3 RESOLUTION CÙNG LÚC ────
        await reportProgress("processing", 20, "Đang encode video (tất cả resolution cùng lúc)...");

        bool allSuccess;
        using (ffmpegDuration.NewTimer())
        {
            allSuccess = await RunFFmpegMultiOutput(
                inputPath, hlsFolder, job.MovieId, globalKeyBytes,
                ffmpegCodec, ffmpegThreads, ffmpegPreset, ffmpegHlsTime,
                qualities.Select(q => new QualityConfig
                {
                    Name      = q.Name,
                    Scale     = q.Scale,
                    Crf       = q.Crf,
                    Audio     = q.Audio,
                    Bandwidth = q.Bandwidth
                }).ToArray()
            );
        }

        // ── BƯỚC 5: HOÀN TẤT ──────────────────────────────────────────
        if (allSuccess)
        {
            // Lưu key vào DB
            var movieToUpdate = await db.Movies.FindAsync(job.MovieId);
            if (movieToUpdate != null)
            {
                movieToUpdate.EncryptionKey = globalKeyBase64;
                await db.SaveChangesAsync();
                Console.WriteLine("[🔐] Đã lưu EncryptionKey vào DB.");
            }

            // Tạo Master Playlist tự động từ danh sách qualities
            string masterPlaylistPath = Path.Combine(hlsFolder, "master.m3u8");
            var    masterSb           = new StringBuilder();
            masterSb.AppendLine("#EXTM3U");
            masterSb.AppendLine("#EXT-X-VERSION:3");
            foreach (var q in qualities)
            {
                masterSb.AppendLine($"#EXT-X-STREAM-INF:BANDWIDTH={q.Bandwidth},RESOLUTION={q.Scale.Replace(":", "x")}");
                masterSb.AppendLine($"{q.Name}/index.m3u8");
            }
            await File.WriteAllTextAsync(masterPlaylistPath, masterSb.ToString());

            // Upload lên R2
            await reportProgress("processing", 90, "Đang upload HLS lên R2...");
            await UploadFolderToR2(s3Client, bucketName, hlsFolder, $"stream/{job.MovieId}/");

            // Xóa file gốc trên R2
            try
            {
                await s3Client.DeleteObjectAsync(bucketName, job.RawPath);
                Console.WriteLine("[+] Đã xóa file MP4 gốc trên R2.");
            }
            catch (Exception ex) { Console.WriteLine($"[!] Lỗi xóa file gốc: {ex.Message}"); }

            job.Status = "done";
            jobCounter.WithLabels("done").Inc();
            await reportProgress("done", 100, "Hoàn tất! Phim đã sẵn sàng phát sóng.");
            Console.WriteLine($"[v] Phim {job.MovieId} hoàn tất!");
        }
        else
        {
            job.Status = "failed";
            jobCounter.WithLabels("failed").Inc();
            await reportProgress("error", 0, "Lỗi: FFmpeg encode thất bại.");
            Console.WriteLine("[X] FFmpeg encode thất bại.");
        }

        job.FinishedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Dọn dẹp thư mục tạm
        try { Directory.Delete(tempFolder, true); } catch { }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"\n[X] LỖI NGHIÊM TRỌNG: {ex.Message}");
        using var dbError  = new AppDbContext(optionsBuilder.Options);
        var failedJob       = await dbError.IngestJobs
            .OrderByDescending(j => j.StartedAt)
            .FirstOrDefaultAsync(j => j.Status == "processing");
        if (failedJob != null)
        {
            failedJob.Status     = "failed";
            failedJob.FinishedAt = DateTime.UtcNow;
            failedJob.Logs       = ex.ToString();
            await dbError.SaveChangesAsync();
        }
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async Task DownloadFileFromR2(IAmazonS3 client, string bucket, string objectKey, string localPath)
{
    var transferUtility = new TransferUtility(client);
    await transferUtility.DownloadAsync(localPath, bucket, objectKey);
}



// [MỚI] 1 lệnh FFmpeg duy nhất — đọc input 1 lần, output tất cả resolution cùng lúc
async Task<bool> RunFFmpegMultiOutput(
    string inputPath, string hlsFolder, string movieId, byte[] keyBytes,
    string codec, string threads, string preset, string hlsTime,
    QualityConfig[] qualityConfigs)
{
    // Tạo key file dùng chung cho tất cả resolution
    string keyFile     = Path.Combine(hlsFolder, "enc.key");
    string keyInfoFile = Path.Combine(hlsFolder, "enc.keyinfo");
    File.WriteAllBytes(keyFile, keyBytes);
    string keyApiUrl   = $"http://localhost:5113/api/public/keys/{movieId}";
    File.WriteAllText(keyInfoFile, $"{keyApiUrl}\n{keyFile}\n");

    // Build FFmpeg args tự động từ danh sách resolution
    var sb = new StringBuilder();
    sb.Append($"-threads {threads} -y -i \"{inputPath}\" ");

    foreach (var q in qualityConfigs)
    {
        Directory.CreateDirectory(Path.Combine(hlsFolder, q.Name));
        string segPath = Path.Combine(hlsFolder, q.Name, "seg%03d.ts").Replace("\\", "/");
        string m3u8    = Path.Combine(hlsFolder, q.Name, "index.m3u8").Replace("\\", "/");

        sb.Append($"-map 0:v:0 -map 0:a:0 ");
        sb.Append($"-vf scale={q.Scale} -c:v {codec} -crf {q.Crf} -preset {preset} ");
        sb.Append($"-c:a aac -b:a {q.Audio} ");
        sb.Append($"-hls_time {hlsTime} -hls_list_size 0 ");
        sb.Append($"-hls_key_info_file \"{keyInfoFile}\" ");
        sb.Append($"-hls_segment_filename \"{segPath}\" \"{m3u8}\" ");
    }

    var startInfo = new ProcessStartInfo
    {
        FileName              = "ffmpeg",
        Arguments             = sb.ToString(),
        UseShellExecute       = false,
        CreateNoWindow        = true,
        RedirectStandardError = true // [MỚI] Bắt log FFmpeg
    };

    using var process = new Process { StartInfo = startInfo };
    process.Start();

    // [MỚI] Hạ priority — máy không bị đơ khi dùng song song
    process.PriorityClass = ProcessPriorityClass.BelowNormal;

    // [MỚI] In tiến độ encode ra console
    _ = Task.Run(async () =>
    {
        while (!process.StandardError.EndOfStream)
        {
            var line = await process.StandardError.ReadLineAsync();
            if (line != null && line.Contains("frame="))
                Console.WriteLine($"  [ffmpeg] {line}");
        }
    });

    await process.WaitForExitAsync();
    return process.ExitCode == 0;
}

async Task UploadFolderToR2(IAmazonS3 client, string bucket, string localFolder, string r2Prefix)
{
    var files = Directory.GetFiles(localFolder, "*.*", SearchOption.AllDirectories);
    foreach (var file in files)
    {
        string fileName = Path.GetFileName(file);
        if (fileName == "enc.key" || fileName == "enc.keyinfo") continue;

        string relativePath = Path.GetRelativePath(localFolder, file);
        string r2Key        = r2Prefix + relativePath.Replace("\\", "/");

        string contentType = "application/octet-stream";
        if (file.EndsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
        else if (file.EndsWith(".ts"))  contentType = "video/MP2T";
        else if (file.EndsWith(".jpg")) contentType = "image/jpeg";
        else if (file.EndsWith(".mp4")) contentType = "video/mp4";

        await client.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest
        {
            BucketName           = bucket,
            Key                  = r2Key,
            FilePath             = file,
            ContentType          = contentType,
            DisablePayloadSigning = true
        });
    }
}

// [MỚI] Model config cho từng resolution
record QualityConfig
{
    public string Name      { get; init; } = "";
    public string Scale     { get; init; } = "";
    public string Crf       { get; init; } = "23";
    public string Audio     { get; init; } = "128k";
    public string Bandwidth { get; init; } = "1000000";
}
