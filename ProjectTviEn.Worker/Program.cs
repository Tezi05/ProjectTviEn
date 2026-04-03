using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Amazon.S3;
using Amazon.S3.Transfer;
using System.Diagnostics;
using Prometheus; // <--- Thêm thư viện này
using ProjectTviEn.Models;

using RedLockNet.SERedis;
using RedLockNet.SERedis.Configuration;
using StackExchange.Redis;
using System.Net;

using System.Linq;

// 1. Khởi tạo Cấu hình (Đọc file appsettings.json)
var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json")
    .Build();

var connectionString = configuration.GetConnectionString("DefaultConnection");

// --- BƯỚC MỚI: KHỞI TẠO MÁY CHỦ METRICS ---
// Mở một cổng riêng (1234) để Prometheus có thể vào lấy dữ liệu
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
// 2.5. Cấu hình Redis & RedLock (Kết nối tới Docker đang chạy cổng 6379)
var redisEndpoints = new[] { new RedLockEndPoint(new DnsEndPoint("localhost", 6379)) };
var redlockFactory = RedLockFactory.Create(redisEndpoints);


Console.WriteLine("--- WORKER HOAT DONG: DANG CHO PHIM MOI... ---");

// 3. Vòng lặp vĩnh cửu (Cứ 10 giây đi quét Database 1 lần)
while (true)
{
    try
    {
        // Tạo kết nối tới DB
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        using (var db = new AppDbContext(optionsBuilder.Options))
        {
            // Tìm 1 Job đang ở trạng thái 'pending' (đang chờ)
            var job = await db.IngestJobs
                .FirstOrDefaultAsync(j => j.Status == "pending");


            if (job != null)
            {
                // --- CƠ CHẾ KHOÁ REDLOCK ---
                // Thử giành lấy cái "khoá" có tên theo ID phim, khóa trong 1 giờ
                var resource = $"movie-lock:{job.MovieId}";
                var expiry = TimeSpan.FromHours(1);

                using (var redlock = await redlockFactory.CreateLockAsync(resource, expiry))
                {
                    // Nếu KHÔNG lấy được khoá -> Có nghĩa là Worker khác đang làm rồi
                    if (!redlock.IsAcquired)
                    {
                        Console.WriteLine($"[!] Phim {job.MovieId} đang được Worker khác xử lý. Bỏ qua...");
                        continue; 
                    }

                    // --- NẾU LẤY ĐƯỢC KHOÁ -> TIẾP TỤC XỬ LÝ NHƯ BÌNH THƯỜNG ---
                    Console.WriteLine($"\n[!] Phát hiện phim mới: {job.MovieId}. Bắt đầu xử lý...");
                    
                    // Cập nhật trạng thái sang 'processing' để không ai tranh giành
                    job.Status = "processing";
                    job.StartedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync();

                // Tạm thời mình chỉ ghi Log ra màn hình, bước sau mình sẽ viết code FFmpeg ở đây
                // ĐOẠN MỚI THỰC TẾ:
                // Tránh lưu vào ổ C. Ta tự gom vào một thư mục con tên là "worker_temp" ngay trong thư mục Project của ổ E.
string tempFolder = Path.Combine(@"E:\Data\Project\worker_temp", job.JobId);

                Directory.CreateDirectory(tempFolder); // Tạo một thư mục tạm để chứa phim
                string inputPath = Path.Combine(tempFolder, "input.mp4");

                Console.WriteLine($"[+] Đang chuẩn bị tải phim từ R2...");
                
                // --- CHẾ ĐỘ WORKER KIÊN NHẪN (Retry trong 60 giây) ---
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
                           throw; // Để nhảy vào catch(Exception ex) bên ngoài báo lỗi Job
                        }
                        Console.WriteLine($"[!] Phim chưa có trên R2. Đang đợi bạn upload... (Lần {currentRetry}/{maxRetries} - Thử lại sau 5s)");
                        await Task.Delay(5000); // Đợi 5 giây rồi thử lại
                    }
                }

                // 2. Transcode bằng FFmpeg với ĐA CHẤT LƯỢNG (480p, 720p, 1080p)
                string hlsFolder = Path.Combine(tempFolder, "hls");
                Directory.CreateDirectory(hlsFolder);

                // 2.1. Định nghĩa danh sách các chất lượng mong muốn
                var qualities = new[] { 
                    new { Name = "480p", Res = "854:480", Bitrate = "800k" },
                    new { Name = "720p", Res = "1280:720", Bitrate = "2500k" },
                    new { Name = "1080p", Res = "1920:1080", Bitrate = "5000k" }
                };

                                // --- CHẠY FFmpeg SONG SONG (PARALLEL TRANSCODING) ---
                Console.WriteLine("[+] Bắt đầu băm phim cùng lúc (480p, 720p, 1080p)...");
                
                // --- BƯỚC MỚI: SINH KHÓA MẬT MÃ CHUNG CHO CẢ 3 BẢN ---
                byte[] globalKeyBytes = new byte[16];
                System.Security.Cryptography.RandomNumberGenerator.Fill(globalKeyBytes);
                string globalKeyBase64 = Convert.ToBase64String(globalKeyBytes);
                Console.WriteLine($"[🔐] Đã sinh KHÓA CHUNG AES-128 cho phim {job.MovieId}");

                var transcodeTasks = qualities.Select(async q => 
                {
                    string qFolder = Path.Combine(hlsFolder, q.Name);
                    Directory.CreateDirectory(qFolder);
                    string qPlaylistPath = Path.Combine(qFolder, "index.m3u8");

                    Console.WriteLine($"  -> Đang xử lý bản {q.Name} ({q.Res})...");
                    using (ffmpegDuration.WithLabels(q.Name).NewTimer())
                    {
                        return await RunFFmpeg(inputPath, qPlaylistPath, q.Res, q.Bitrate, job.MovieId, globalKeyBytes);
                    }
                });

                // Chờ tất cả 3 tiến trình cùng chạy xong
                var transcodeResults = await Task.WhenAll(transcodeTasks);
                bool allSuccess = transcodeResults.All(r => r == true);

                if (allSuccess)
                {
                    // Lưu EncryptionKey Chung vào Database
                    var movieToUpdate = await db.Movies.FindAsync(job.MovieId);
                    if (movieToUpdate != null)
                    {
                        movieToUpdate.EncryptionKey = globalKeyBase64;
                        await db.SaveChangesAsync();
                        Console.WriteLine($"  [🔐] Đã lưu EncryptionKey vào Database cho phim {job.MovieId}");
                    }

                    // 2.2. Tạo file Master Playlist để gộp 3 chất lượng lại
                    string masterPlaylistPath = Path.Combine(hlsFolder, "master.m3u8");
                    string masterContent = "#EXTM3U\n" +
                        "#EXT-X-VERSION:3\n" +
                        "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p/index.m3u8\n" +
                        "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720p/index.m3u8\n" +
                        "#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080p/index.m3u8";

                    await File.WriteAllTextAsync(masterPlaylistPath, masterContent);
                    Console.WriteLine("[v] Đã tạo file master.m3u8 thành công.");

                    // 3. Upload kết quả lên R2 (vào folder stream/)
                    string r2StreamPath = $"stream/{job.MovieId}/";
                    Console.WriteLine($"[+] Đang upload kết quả HLS lên R2: {r2StreamPath}...");
                    await UploadFolderToR2(s3Client, bucketName, hlsFolder, r2StreamPath);

                    Console.WriteLine($"[v] comlpte! Phim {job.MovieId} ready to play.");
                    job.Status = "done";
                    jobCounter.WithLabels("done").Inc();

                    // Dọn dẹp file MP4 gốc trên R2 để tiết kiệm bộ nhớ
                    try 
                    {
                        Console.WriteLine($"[+] Đang xóa file MP4 gốc trên R2: {job.RawPath}...");
                        await s3Client.DeleteObjectAsync(bucketName, job.RawPath);
                        Console.WriteLine("[v] Đã xóa file gốc thành công.");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[!] Cảnh báo: Không thể xóa file gốc: {ex.Message}");
                    }
                }
                else
                {
                    Console.WriteLine($"[X] Lỗi: FFmpeg không thể xử lý phim.");
                    job.Status = "failed";
                    jobCounter.WithLabels("failed").Inc();
                }

                job.FinishedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();

                    // 4. Dọn dẹp thư mục tạm
                    try { Directory.Delete(tempFolder, true); } catch { }
                }
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"\n[X] LOI NGHIEM TRONG: {ex.Message}");
        
        // --- BƯỚC MỚI: LƯU LỖI VÀO DATABASE ---
        try 
        {
            // Tạo một kết nối mới để lưu lỗi (đề phòng kết nối cũ bị hỏng)
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseNpgsql(connectionString);
            using (var dbError = new AppDbContext(optionsBuilder.Options))
            {
                // Tìm lại Job bị lỗi cuối cùng (đang ở trạng thái processing)
                var failedJob = await dbError.IngestJobs
                    .OrderByDescending(j => j.StartedAt)
                    .FirstOrDefaultAsync(j => j.Status == "processing");

                if (failedJob != null)
                {
                    failedJob.Status = "failed";
                    jobCounter.WithLabels("failed").Inc();
                    failedJob.FinishedAt = DateTime.UtcNow;
                    // Lưu toàn bộ chi tiết lỗi để sau này debug
                    failedJob.Logs = ex.ToString(); 
                    
                    await dbError.SaveChangesAsync();
                    Console.WriteLine($"[v] Đã ghi nhận lỗi cho Job {failedJob.JobId} vào Database.");
                }
            }
        }
        catch (Exception dbEx)
        {
            Console.WriteLine($"[!] Canh bao: Khong the luu log loi vao DB: {dbEx.Message}");
        }
    }

    await Task.Delay(10000); // Nghỉ 10 giây rồi tìm tiếp

}
   // Hàm hỗ trợ tải file từ R2 về máy local
async Task DownloadFileFromR2(IAmazonS3 client, string bucket, string objectKey, string localPath)
{
    var transferUtility = new TransferUtility(client);
    await transferUtility.DownloadAsync(localPath, bucket, objectKey);
}
// Hàm gọi FFmpeg để biến MP4 thành m3u8 (HLS) với mã hóa AES-128
async Task<bool> RunFFmpeg(string inputPath, string outputPath, string resolution, string videoBitrate, string movieId, byte[] keyBytes)
{
    string outputDir = Path.GetDirectoryName(outputPath)!;
    string keyFile = Path.Combine(outputDir, "enc.key");
    string keyInfoFile = Path.Combine(outputDir, "enc.keyinfo");

    // --- BẮN BỘT ỚT: Copy chìa khóa chung vào từng thư mục ---
    File.WriteAllBytes(keyFile, keyBytes);

    // File keyinfo: Dòng 1 = URL API lấy chìa, Dòng 2 = đường dẫn file key thật
    string keyApiUrl = $"http://localhost:5113/api/public/keys/{movieId}";
    File.WriteAllText(keyInfoFile, $"{keyApiUrl}\n{keyFile}\n");

    var startInfo = new ProcessStartInfo
    {
        FileName = "ffmpeg",
        Arguments = $"-y -i \"{inputPath}\" -vf scale={resolution} -c:v libx264 -b:v {videoBitrate} " +
                    $"-c:a aac -hls_time 10 -hls_list_size 0 " +
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


// Hàm upload nguyên cả thư mục lên Cloudflare R2
async Task UploadFolderToR2(IAmazonS3 client, string bucket, string localFolder, string r2Prefix)
{
    // LẤY TẤT CẢ FILE TRONG CẢ THƯ MỤC CON (AllDirectories)
    var files = Directory.GetFiles(localFolder, "*.*", SearchOption.AllDirectories);
    
    foreach (var file in files)
    {
        // BÍ MẬT: Không bao giờ upload file khóa AES lên R2 Public!
        string fileName = Path.GetFileName(file);
        if (fileName == "enc.key" || fileName == "enc.keyinfo")
        {
            Console.WriteLine($"  [🔐] Bỏ qua file bí mật: {fileName}");
            continue;
        }

        // Tính toán đường dẫn tương đối (ví dụ: "480p\index.m3u8")
        string relativePath = Path.GetRelativePath(localFolder, file);

        
        // Chuyển dấu gạch chéo ngược (\) của Windows thành gạch chéo xuôi (/) của Web
        string r2Key = r2Prefix + relativePath.Replace("\\", "/"); 
        
        var putRequest = new Amazon.S3.Model.PutObjectRequest
        {
            BucketName = bucket,
            Key = r2Key,
            FilePath = file,
            // Tự động nhận diện loại file để trình duyệt xem được
            ContentType = file.EndsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/MP2T",
            DisablePayloadSigning = true 
        };

        await client.PutObjectAsync(putRequest);
    }
}

