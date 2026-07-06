using System.Collections.Generic;
using ProjectTviEn.Models;

namespace ProjectTviEn.DTOs
{
    public class MovieUpdateDto
    {
        public string Title { get; set; } = string.Empty;
        public string? OriginalTitle { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? ReleaseYear { get; set; }
        public int? Duration { get; set; }
        public string? AgeRating { get; set; }
        public int Status { get; set; }
        public MovieType Type { get; set; } = MovieType.SingleMovie; // Phân loại: SingleMovie=1, TvSeries=2
        public bool IsIndie { get; set; } = false;
        public string? PosterUrl { get; set; }
        public string? BackdropUrl { get; set; }
        public string? TrailerUrl { get; set; }

        // Danh sách ID thể loại
        public List<int> GenreIds { get; set; } = new List<int>();

        // Danh sách nhân sự kèm vai trò
        public List<CrewMemberDto> CrewMembers { get; set; } = new List<CrewMemberDto>();
    }

    public class CrewMemberDto
    {
        public string PersonId { get; set; } = string.Empty;
        public int RoleId { get; set; } // 1: Đạo diễn, 2: Diễn viên, 3: Biên kịch
    }
}
