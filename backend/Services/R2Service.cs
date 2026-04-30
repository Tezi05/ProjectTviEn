using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;

namespace ProjectTviEn.Services
{
    public class R2Service : IR2Service
    {
        private readonly IAmazonS3 _s3Client;
        private readonly IConfiguration _configuration; // <--- Thêm dòng này để lưu cấu hình
        private readonly string _bucketName;

        public R2Service(IConfiguration configuration){
            _configuration = configuration; // <--- Gán vào biến dùng chung
            var accessKey = _configuration["R2:AccessKey"];
            var secretKey = _configuration["R2:SecretKey"];
            var serviceUrl = _configuration["R2:Endpoint"];
            _bucketName = _configuration["R2:BucketName"];

            var config = new AmazonS3Config
            {
                ServiceURL = serviceUrl,
                ForcePathStyle = true,
                SignatureVersion = "4", // R2 yêu cầu SigV4
                AuthenticationRegion = "auto" // R2 dùng vùng 'auto'
            };

            _s3Client = new AmazonS3Client(accessKey, secretKey, config);
        }

        public string GeneratePresignedUploadUrl(string objectKey, int expiresMinutes = 30){
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucketName,
                Key = objectKey,
                Verb = HttpVerb.PUT,
                Expires = DateTime.UtcNow.AddMinutes(expiresMinutes),
                ContentType = "video/mp4" // Ký sẵn loại file để đảm bảo an toàn
            };

            return _s3Client.GetPreSignedURL(request);
        }

        public string GeneratePresignedDownloadUrl(string objectKey){
            // Lấy thời gian hết hạn từ cấu hình (mặc định 2 giờ)
            var expiryHours = _configuration.GetValue<int>("R2:PlaybackExpiryHours");
            
            var request = new GetPreSignedUrlRequest    
            {
                BucketName = _configuration["R2:BucketName"],
                Key = objectKey,
                Expires = DateTime.UtcNow.AddHours(expiryHours)
            };

            return _s3Client.GetPreSignedURL(request);
        }

        public async Task DeleteFilesWithPrefix(string prefix){
            var ListRequest = new ListObjectsV2Request
            {
                BucketName = _bucketName,
                Prefix = prefix
            };

            var ListResponse = await _s3Client.ListObjectsV2Async(ListRequest);

            if(ListResponse.S3Objects.Count == 0){
                return;
            }

            var DeleteRequest = new DeleteObjectsRequest
            {
                BucketName = _bucketName,
                Objects = ListResponse.S3Objects.Select(o => new KeyVersion { Key = o.Key }).ToList()
            };

            await _s3Client.DeleteObjectsAsync(DeleteRequest);
        }    

        public async Task<string?> GetFileContentAsync(string objectKey){
            try 
            {
                var request = new GetObjectRequest
                {
                    BucketName = _bucketName,
                    Key = objectKey
                };
                using var response = await _s3Client.GetObjectAsync(request);
                using var reader = new StreamReader(response.ResponseStream);
                return await reader.ReadToEndAsync();
            }
            catch (AmazonS3Exception ex) when (ex.ErrorCode == "NoSuchKey")
            {
                return null; // Return null if file doesn't exist
            }
        }
        
    }
}
