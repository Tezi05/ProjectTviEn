using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Amazon.S3;
using Amazon.S3.Transfer;
using System.Diagnostics;
using System.Text;
using Prometheus;
using StackExchange.Redis;

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
var ffmpegCrf           = configuration["FFmpegConfig:Crf"]        ?? "23"; 

var qualities = new[]
{
    new { Name = "480p",  Scale = "854:480",   Crf = "23", Audio = "96k",  Bandwidth = "800000"  },
    new { Name = "720p",  Scale = "1280:720",  Crf = "22", Audio = "128k", Bandwidth = "2500000" },
    new { Name = "1080p", Scale = "1920:1080", Crf = "21", Audio = "192k", Bandwidth = "5000000" },
};

var metricServer = new MetricServer(port: 1234);
metricServer.Start();

var jobCounter      = Metrics.CreateCounter("worker_jobs_total", "Total jobs processed", new CounterConfiguration { LabelNames = new[] { "status" } });
var ffmpegDuration  = Metrics.CreateHistogram("worker_ffmpeg_duration_seconds", "Duration of FFmpeg transcoding");

var r2Config = new AmazonS3Config { ServiceURL = configuration["R2:Endpoint"], ForcePathStyle = true, SignatureVersion = "4", AuthenticationRegion = "auto" };
var s3Client   = new AmazonS3Client(configuration["R2:AccessKey"], configuration["R2:SecretKey"], r2Config);
var bucketName = configuration["R2:BucketName"];

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseNpgsql(connectionString);

var redisMux = ConnectionMultiplexer.Connect(redisConnectionStr);
var dbRedis  = redisMux.GetDatabase();

while (true)
{
    try
    {
        var queueVal = await dbRedis.ListRightPopAsync("tvien:ingest_queue");
        if (!queueVal.HasValue) { await Task.Delay(3000); continue; }

        string currentJobId = queueVal.ToString();
        using var db  = new AppDbContext(optionsBuilder.Options);
        var job        = await db.IngestJobs.FirstOrDefaultAsync(j => j.JobId == currentJobId);
        if (job == null) continue;

        job.Status    = "processing";
        job.StartedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var reportProgress = async (string status, int percent, string detail) => {
            var payload = $"{{\"Status\":\"{status}\", \"Percent\":{percent}, \"Detail\":\"{detail}\"}}";
            await dbRedis.StringSetAsync($"job:progress:{job.MovieId}", payload, TimeSpan.FromDays(1));
        };

        string tempFolder = Path.Combine(@"E:\Data\Project\worker_temp", job.JobId);
        Directory.CreateDirectory(tempFolder);
        string inputPath = Path.Combine(tempFolder, "input.mp4");
        await new TransferUtility(s3Client).DownloadAsync(inputPath, bucketName, job.RawPath);

        string hlsFolder = Path.Combine(tempFolder, "hls");
        Directory.CreateDirectory(hlsFolder);
        
        byte[] keyBytes = new byte[16];
        System.Security.Cryptography.RandomNumberGenerator.Fill(keyBytes);
        
        bool success = await RunFFmpeg(inputPath, hlsFolder, job.MovieId, keyBytes, ffmpegCodec, ffmpegThreads, ffmpegPreset, ffmpegHlsTime, qualities.Select(q => new QualityConfig { Name = q.Name, Scale = q.Scale, Crf = q.Crf, Audio = q.Audio, Bandwidth = q.Bandwidth }).ToArray());

        if (success)
        {
            var movie = await db.Movies.FindAsync(job.MovieId);
            if (movie != null) { movie.EncryptionKey = Convert.ToBase64String(keyBytes); await db.SaveChangesAsync(); }

            string masterPath = Path.Combine(hlsFolder, "master.m3u8");
            var sb = new StringBuilder("#EXTM3U\n#EXT-X-VERSION:3\n");
            foreach (var q in qualities) { sb.AppendLine($"#EXT-X-STREAM-INF:BANDWIDTH={q.Bandwidth},RESOLUTION={q.Scale.Replace(":", "x")}\n{q.Name}/index.m3u8"); }
            await File.WriteAllTextAsync(masterPath, sb.ToString());

            await UploadFolderToR2(s3Client, bucketName, hlsFolder, $"stream/{job.MovieId}/");

            var existingVideo = await db.Videos.FirstOrDefaultAsync(v => v.MovieId == job.MovieId && !v.IsDeleted);
            if (existingVideo == null) {
                db.Videos.Add(new Video { VideoId = Guid.NewGuid().ToString("N"), MovieId = job.MovieId, Resolution = "multi", MasterPlaylistUrl = $"stream/{job.MovieId}/master.m3u8", IsEncrypted = true, CreatedAt = DateTime.UtcNow });
                await db.SaveChangesAsync();
            }
            job.Status = "done";
            await reportProgress("done", 100, "Hoàn tất!");
        } else { job.Status = "failed"; }

        job.FinishedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        try { Directory.Delete(tempFolder, true); } catch { }
    } catch (Exception ex) { Console.WriteLine(ex.Message); }
}

async Task<bool> RunFFmpeg(string inputPath, string hlsFolder, string movieId, byte[] keyBytes, string codec, string threads, string preset, string hlsTime, QualityConfig[] qualityConfigs)
{
    string keyFile = Path.Combine(hlsFolder, "enc.key");
    string keyInfoFile = Path.Combine(hlsFolder, "enc.keyinfo");
    File.WriteAllBytes(keyFile, keyBytes);
    string keyApiUrl = $"http://localhost:5113/api/public/keys/{movieId}";
    File.WriteAllText(keyInfoFile, $"{keyApiUrl}\n{keyFile}\n");

    var sb = new StringBuilder($"-threads {threads} -y -i \"{inputPath}\" ");
    foreach (var q in qualityConfigs) {
        Directory.CreateDirectory(Path.Combine(hlsFolder, q.Name));
        sb.Append($"-map 0:v:0 -map 0:a:0 -vf scale={q.Scale} -c:v {codec} -crf {q.Crf} -preset {preset} -c:a aac -b:a {q.Audio} -hls_time {hlsTime} -hls_list_size 0 -hls_key_info_file \"{keyInfoFile}\" -hls_segment_filename \"{hlsFolder}/{q.Name}/seg%03d.ts\" \"{hlsFolder}/{q.Name}/index.m3u8\" ");
    }
    var process = Process.Start(new ProcessStartInfo { FileName = "ffmpeg", Arguments = sb.ToString(), UseShellExecute = false, CreateNoWindow = true });
    await process!.WaitForExitAsync();
    return process.ExitCode == 0;
}

async Task UploadFolderToR2(IAmazonS3 client, string bucket, string localFolder, string r2Prefix)
{
    var files = Directory.GetFiles(localFolder, "*.*", SearchOption.AllDirectories);
    foreach (var file in files) {
        if (file.EndsWith(".key") || file.EndsWith(".keyinfo")) continue;
        string r2Key = r2Prefix + Path.GetRelativePath(localFolder, file).Replace("\\", "/");
        await client.PutObjectAsync(new Amazon.S3.Model.PutObjectRequest { BucketName = bucket, Key = r2Key, FilePath = file, DisablePayloadSigning = true });
    }
}

record QualityConfig { public string Name { get; init; } = ""; public string Scale { get; init; } = ""; public string Crf { get; init; } = "23"; public string Audio { get; init; } = "128k"; public string Bandwidth { get; init; } = "1000000"; }
