namespace ProjectTviEn.Models
{
    /// <summary>
    /// DTO dùng để wrap IFormFile cho Swashbuckle không bị crash khi generate swagger.json
    /// </summary>
    public class FileUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    public class UploadMediaRequest
    {
        public IFormFile? File { get; set; }
        public string MovieId { get; set; } = "";
        public string AssetType { get; set; } = "";
        public bool AutoIngest { get; set; }
        public string? EpisodeId { get; set; }
    }
}
