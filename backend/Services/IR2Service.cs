namespace ProjectTviEn.Services
{
    public interface IR2Service
    {
        /// <summary>
        /// Tạo một URL tạm thời (Pre-signed URL) để Client có thể upload file trực tiếp lên R2 mà không cần qua Server.
        /// </summary>
        /// <param name="objectKey">Tên file (đường dẫn) trên R2</param>
        /// <param name="expiresMinutes">Thời gian link có hiệu lực</param>
        /// <returns>URL để upload</returns>
        string GeneratePresignedUploadUrl(string objectKey, int expiresMinutes = 30);
        string GeneratePresignedDownloadUrl(string objectKey);
        Task DeleteFilesWithPrefix(string prefix);
        Task<string?> GetFileContentAsync(string objectKey);
        
        /// <summary>
        /// Nén ảnh, Resize và Upload lên R2
        /// </summary>
        Task<string> UploadImageAsync(Stream imageStream, string folder, string fileName, int? width = null, int? height = null);

        /// <summary>
        /// Upload file bất kỳ lên R2
        /// </summary>
        Task<bool> UploadFileAsync(string objectKey, Stream fileStream, string contentType);
    }
}
