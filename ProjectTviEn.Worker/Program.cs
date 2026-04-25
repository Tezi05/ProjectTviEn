using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Amazon.S3;
using Amazon.S3.Transfer;
using System.Diagnostics;
using Prometheus;
using StackExchange.Redis;
using System.Net;
using System.Linq;

// 1. Khởi tạo Cấu hình (Đọc file appsettings.json)
var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json")
    .Build();

var connectionString = configuration.GetConnectionString("DefaultConnection");
var redisConnectionStr = configuration.GetConnectionString("Redis") ?? "localhost:6379";
var ffmpegCodec = configuration["FFmpegConfig:VideoCodec"] ?? "libx264";
var ffmpegThreads = configuration["FFmpegConfig:Threads"] ?? "2";
var ffmpegPreset = configuration["FFmpegConfig:Preset"] ?? "ultrafast";
var ffmpegHlsTime = configuration["FFmpegConfig:HlsTime"] ?? "10";

// --- BƯỚC MỚI: KHỞI TẠO MÁY CHỦ METRICS ---
var metricServer = new MetricServer(port: 1234);
metricServer.Start();
Console.WriteLine("[v] Monitoring Server started on port 1234.");

var jobCounter = Metrics.CreateCounter("worker_jobs_total", "Total jobs processed", new CounterConfiguration { LabelNames = new[] { "status" } });
var ffmpegDuration = Metrics.CreateHistogram("worker_ffmpeg_duration_seconds", "Duration of FFmpeg transcoding", new HistogramConfiguration { LabelNames = new[] { "quality" } });

// 2. Cấu hình Cloudflare R2
var r2Config = new AmazonS3Config
{
    ServiceURL = configuration["R2:Endpoint"],
    ForcePathStyle = true,
    SignatureVersion = "4",
    AuthenticationRegion = "auto"
};
var s3Client = new AmazonS3Client(configuration["R2:AccessKey"], configuration["R2:SecretKey"], r2Config);
var bucketName = configuration["R2:BucketName"];

// 2.5 Cấu hình DB và Redis
var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseNpgsql(connectionString);

var redisMux = ConnectionMultiplexer.Connect(redisConnectionStr);
var dbRedis = redisMux.GetDatabase();

Console.WriteLine("--- WORKER KHOI DONG: TIEN HANH DON DEP (ZOMBIE SWEEPER) ---");

using (var db = new AppDbContext(optionsBuilder.Options))
{
    var twoHoursAgo = DateTime.UtcNow.AddHours(-2);
    var zombies = await db.IngestJobs
        .Where(j => j.Status == "processing" && j.StartedAt < twoHoursAgo)
        .ToListAsync();

    if (zombies.Any())
    {
        Console.WriteLine($"[!] Phat hien {zombies.Count} zombies. Dang don dep...");
        foreach (var z in zombies)
        {
            z.Status = "pending";
            // Xóa rác cũ
            string zombieFolder = Path.Combine(@"E:\Data\Project\worker_temp", z.JobId);
            try { if (Directory.Exists(zombieFolder)) { Directory.Delete(zombieFolder, true); } } catch { }
            
            // Đẩy lại vào Redis Queue
            await dbRedis.ListLeftPushAsync("tvien:ingest_queue", z.JobId);
            Console.WriteLine($"  -> Đã reset Zombie Job: {z.JobId}");
        }
        await db.SaveChangesAsync();
    }
}

Console.WriteLine("--- WORKER HOANG TẤT CHUẨN BỊ: ĐANG CHỜ PHIM... ---");

while (true)
{
    try
    {
        // Kéo việc từ Hàng Đợi (Queue 1-1)
        var queueVal = await dbRedis.ListRightPopAsync("tvien:ingest_queue");
        if (!queueVal.HasValue)
        {
            await Task.Delay(3000); // Ngủ 3 giây nếu không có phim
            continue;
        }

        string currentJobId = queueVal.ToString();
        
        using (var db = new AppDbContext(optionsBuilder.Options))
        {
            var job = await db.IngestJobs.FirstOrDefaultAsync(j => j.JobId == currentJobId);
            if (job == null) continue;

            Console.WriteLine($"\n[!] Bắt được phim mới: {job.MovieId}. Bắt đầu xử lý tuần tự...");
                    
            job.Status = "processing";
            job.StartedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            var reportProgress = async (string status, int percent, string detail) => {
                var payload = $"{{\"Status\":\"{status}\", \"Percent\":{percent}, \"Detail\":\"{detail}\"}}";
                await dbRedis.StringSetAsync($"job:progress:{job.MovieId}", payload, TimeSpan.FromDays(1));
            };

            await reportProgress("processing", 0, "Đang tải video gốc từ R2 xuống máy chủ xử lý...");

            string tempFolder = Path.Combine(@"E:\Data\Project\worker_temp", job.JobId);
            Directory.CreateDirectory(tempFolder);
            string inputPath = Path.Combine(tempFolder, "input.mp4");

            Console.WriteLine($"[+] Đang chuẩn bị tải phim từ R2...");
            
            bool downloaded = false;
            int maxRetries = 12; // 12 lần * 5 giây = 60 giây
            int currentRetry = 0;

            while (currentRetry <= maxRetries && !downloaded)
            {
                try 
                {
                    await DownloadFileFromR2(s3Client, bucketName, job.RawPath, inputPath);
                    downloaded = true;
                    Console.WriteLine("[v] Tải thành công! Phim đã sẵn sàng để xử lý.");
                }
                catch (AmazonS3Exception ex) when (ex.ErrorCode == "NoSuchKey")
                {
                    currentRetry++;
                    if (currentRetry > maxRetries) 
                    {
                        Console.WriteLine($"[X] Quá 60 giây vẫn không thấy phim. Bỏ qua.");
                        throw; 
                    }
                    Console.WriteLine($"[!] Phim chưa có trên R2. Đang đợi update... Lần {currentRetry}/{maxRetries}");
                    await Task.Delay(5000);
                }
            }

            // 2. Transcode bằng FFmpeg TUẦN TỰ
            string hlsFolder = Path.Combine(tempFolder, "hls");
            Directory.CreateDirectory(hlsFolder);

            var qualities = new[] { 
                new { Name = "480p", Res = "854:480", Bitrate = "800k" },
                new { Name = "720p", Res = "1280:720", Bitrate = "2500k" },
                new { Name = "1080p", Res = "1920:1080", Bitrate = "5000k" }
            };

            // --- CHIẾN LƯỢC PUBLIC ASSET (Tạo Thumbnail & Preview MP4) ---
            await reportProgress("processing", 10, "Đang trích xuất ảnh đại diện và video preview...");
            string thumbnailPath = Path.Combine(hlsFolder, "thumbnail.jpg");
            string previewPath = Path.Combine(hlsFolder, "preview.mp4");
            Console.WriteLine("[+] Đang trích xuất ảnh đại diện và video preview...");
            
            try {
                // Chỉ cắt ảnh từ video nếu Admin chưa tự upload Poster (PosterUrl trong DB trống)
                var movieInfo = await db.Movies.FindAsync(job.MovieId);
                if (movieInfo == null || string.IsNullOrEmpty(movieInfo.PosterUrl))
                {
                    var thumbProc = Process.Start(new ProcessStartInfo("ffmpeg", $"-y -i \"{inputPath}\" -ss 00:00:00.000 -vframes 1 \"{thumbnailPath}\"") { CreateNoWindow = true, UseShellExecute = false });
                    await thumbProc!.WaitForExitAsync();
                }
                else
                {
                    Console.WriteLine("[i] Phim đã có Custom Poster, bỏ qua bước cắt ảnh tự động.");
                }
                
                var previewProc = Process.Start(new ProcessStartInfo("ffmpeg", $"-y -i \"{inputPath}\" -t 10 -vf scale=480:-2 -an -c:v libx264 -preset ultrafast -crf 28 \"{previewPath}\"") { CreateNoWindow = true, UseShellExecute = false });
                await previewProc!.WaitForExitAsync();

                if (File.Exists(thumbnailPath) && File.Exists(previewPath)) {
                    Console.WriteLine("[v] Trích xuất Public Asset thành công!");
                } else {
                    Console.WriteLine("[X] Cảnh báo: FFmpeg chạy xong nhưng không thấy file thumbnail.jpg hoặc preview.mp4. Có thể video gốc bị lỗi hoặc quá ngắn.");
                }
            } catch (Exception ex) {
                Console.WriteLine($"[X] Lỗi tạo Public Asset (Kiểm tra lại xem đã cài FFmpeg chưa): {ex.Message}");
            }

            Console.WriteLine("[+] Bắt đầu nén phim TUẦN TỰ (480p -> 720p -> 1080p)...");
            
            byte[] globalKeyBytes = new byte[16];
            System.Security.Cryptography.RandomNumberGenerator.Fill(globalKeyBytes);
            string globalKeyBase64 = Convert.ToBase64String(globalKeyBytes);
            Console.WriteLine($"[🔐] Đã sinh KHÓA CHUNG AES-128 cho phim {job.MovieId}");

            bool allSuccess = true;

            foreach (var q in qualities)
            {
                string qFolder = Path.Combine(hlsFolder, q.Name);
                Directory.CreateDirectory(qFolder);
                string qPlaylistPath = Path.Combine(qFolder, "index.m3u8");

                Console.WriteLine($"  -> Đang nén bản {q.Name} ({q.Res})...");
                
                int currentPercent = q.Name == "480p" ? 30 : (q.Name == "720p" ? 60 : 90);
                await reportProgress("processing", currentPercent, $"Đang nén bản {q.Name} ({q.Res})...");

                using (ffmpegDuration.WithLabels(q.Name).NewTimer())
                {
                    bool success = await RunFFmpeg(
                        inputPath, qPlaylistPath, q.Res, q.Bitrate, job.MovieId, globalKeyBytes,
                        ffmpegCodec, ffmpegThreads, ffmpegPreset, ffmpegHlsTime
                    );
                    
                    if (!success) {
                        allSuccess = false;
                        break;
                    }
                }
            }

            if (allSuccess)
            {
                var movieToUpdate = await db.Movies.FindAsync(job.MovieId);
                if (movieToUpdate != null)
                {
                    movieToUpdate.EncryptionKey = globalKeyBase64;
                    await db.SaveChangesAsync();
                    Console.WriteLine($"  [🔐] Đã lưu EncryptionKey.");
                }

                // Chốt Master Playlist
                string masterPlaylistPath = Path.Combine(hlsFolder, "master.m3u8");
                string masterContent = "#EXTM3U\n" +
                    "#EXT-X-VERSION:3\n" +
                    "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p/index.m3u8\n" +
                    "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720p/index.m3u8\n" +
                    "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080p/index.m3u8";

                await File.WriteAllTextAsync(masterPlaylistPath, masterContent);

                // Upload chốt đơn
                string r2StreamPath = $"stream/{job.MovieId}/";
                Console.WriteLine($"[+] Đang upload kết quả HLS lên R2 một lần duy nhất...");
                await reportProgress("processing", 99, "Đang tải các phân mảnh HLS lên lại R2...");
                await UploadFolderToR2(s3Client, bucketName, hlsFolder, r2StreamPath);

                Console.WriteLine($"[v] complete! Phim {job.MovieId} đã sẵn sàng.");
                job.Status = "done";
                jobCounter.WithLabels("done").Inc();
                await reportProgress("done", 100, "Hoàn tất! Phim đã sẵn sàng phát sóng.");

                try 
                {
                    Console.WriteLine($"[+] Đang xóa file MP4 gốc trên R2...");
                    await s3Client.DeleteObjectAsync(bucketName, job.RawPath);
                }
                catch (Exception ex) { Console.WriteLine($"[!] Lỗi xóa file gốc: {ex.Message}"); }
            }
            else
            {
                Console.WriteLine($"[X] Lỗi: FFmpeg nén thất bại.");
                job.Status = "failed";
                jobCounter.WithLabels("failed").Inc();
                await reportProgress("error", 0, "Lỗi: FFmpeg nén thất bại. Vui lòng kiểm tra lại file gốc.");
            }

            job.FinishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            // Dọn dẹp ổ E cục bộ
            try { Directory.Delete(tempFolder, true); } catch { }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"\n[X] LOI NGHIEM TRONG: {ex.Message}");
        // Thêm đoạn code xử lý lỗi cập nhật trạng thái...
        using (var dbError = new AppDbContext(optionsBuilder.Options))
        {
            var failedJob = await dbError.IngestJobs.OrderByDescending(j => j.StartedAt).FirstOrDefaultAsync(j => j.Status == "processing");
            if (failedJob != null)
            {
                failedJob.Status = "failed";
                failedJob.FinishedAt = DateTime.UtcNow;
                failedJob.Logs = ex.ToString(); 
                await dbError.SaveChangesAsync();
                Console.WriteLine($"[v] Đã ghi nhận lỗi cho Job {failedJob.JobId}.");
            }
        }
    }
}

async Task DownloadFileFromR2(IAmazonS3 client, string bucket, string objectKey, string localPath)
{
    var transferUtility = new TransferUtility(client);
    await transferUtility.DownloadAsync(localPath, bucket, objectKey);
}

async Task<bool> RunFFmpeg(string inputPath, string outputPath, string resolution, string videoBitrate, string movieId, byte[] keyBytes, string codec, string threads, string preset, string hlsTime)
{
    string outputDir = Path.GetDirectoryName(outputPath)!;
    string keyFile = Path.Combine(outputDir, "enc.key");
    string keyInfoFile = Path.Combine(outputDir, "enc.keyinfo");

    File.WriteAllBytes(keyFile, keyBytes);
    string keyApiUrl = $"http://localhost:5113/api/public/keys/{movieId}";
    File.WriteAllText(keyInfoFile, $"{keyApiUrl}\n{keyFile}\n");

    // Ép xung tham số
    string encodingParams = $"-c:v {codec} -b:v {videoBitrate}";
    if (codec == "libx264") {
        encodingParams += $" -preset {preset} -threads {threads}";
    }

    var startInfo = new ProcessStartInfo
    {
        FileName = "ffmpeg",
        Arguments = $"-y -i \"{inputPath}\" -vf scale={resolution} {encodingParams} " +
                    $"-c:a aac -hls_time {hlsTime} -hls_list_size 0 " +
                    $"-hls_key_info_file \"{keyInfoFile}\" " +
                    $"-f hls \"{outputPath}\"",
        UseShellExecute = false,
        CreateNoWindow = true
    };

    using var process = new Process { StartInfo = startInfo };
    process.Start();
    await process.WaitForExitAsync();
    return process.ExitCode == 0;
}

async Task UploadFolderToR2(IAmazonS3 client, string bucket, string localFolder, string r2Prefix)
{
    var files = Directory.GetFiles(localFolder, "*.*", SearchOption.AllDirectories);
    foreach (var file in files)
    {
        string fileName = Path.GetFileName(file);
        if (fileName == "enc.key" || fileName == "enc.keyinfo") { continue; }

        string relativePath = Path.GetRelativePath(localFolder, file);
        string r2Key = r2Prefix + relativePath.Replace("\\", "/"); 
        
        string contentType = "application/octet-stream";
        if (file.EndsWith(".m3u8")) contentType = "application/vnd.apple.mpegurl";
        else if (file.EndsWith(".ts")) contentType = "video/MP2T";
        else if (file.EndsWith(".jpg")) contentType = "image/jpeg";
        else if (file.EndsWith(".mp4")) contentType = "video/mp4";

        var putRequest = new Amazon.S3.Model.PutObjectRequest
        {
            BucketName = bucket,
            Key = r2Key,
            FilePath = file,
            ContentType = contentType,
            DisablePayloadSigning = true 
        };

        await client.PutObjectAsync(putRequest);
    }
}
