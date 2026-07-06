using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;

namespace ProjectTviEn.Data
{
    public static class DataSeeder
    {
        public static async Task SeedAsync(AppDbContext context)
        {
            // 1. Roles
            if (!await context.Roles.AnyAsync())
            {
                context.Roles.AddRange(
                    new Role { RoleId = 1, Name = "Admin" },
                    new Role { RoleId = 2, Name = "VIP" },
                    new Role { RoleId = 3, Name = "Member" }
                );
                await context.SaveChangesAsync();
            }

            // 2. Genres
            if (!await context.Genres.AnyAsync())
            {
                context.Genres.AddRange(
                    new Genre { Name = "Hành động", Slug = "hanh-dong" },
                    new Genre { Name = "Tình cảm", Slug = "tinh-cam" },
                    new Genre { Name = "Kinh dị", Slug = "kinh-di" },
                    new Genre { Name = "Hài kịch", Slug = "hai-kich" },
                    new Genre { Name = "Khoa học viễn tưởng", Slug = "sci-fi" },
                    new Genre { Name = "Phim độc lập", Slug = "phim-doc-lap" },
                    new Genre { Name = "Phim thương mại", Slug = "phim-thuong-mai" }
                );
                await context.SaveChangesAsync();
            }

            // 3. Persons
            if (!await context.Persons.AnyAsync())
            {
                context.Persons.AddRange(
                    new Person { Id = "p1", FullName = "Trấn Thành", Slug = "tran-thanh", Nationality = "Việt Nam", Dob = new DateOnly(1987, 2, 5) },
                    new Person { Id = "p2", FullName = "Christopher Nolan", Slug = "christopher-nolan", Nationality = "Anh", Dob = new DateOnly(1970, 7, 30) },
                    new Person { Id = "p3", FullName = "Cillian Murphy", Slug = "cillian-murphy", Nationality = "Ireland", Dob = new DateOnly(1976, 5, 25) },
                    new Person { Id = "p4", FullName = "Ninh Dương Lan Ngọc", Slug = "lan-ngoc", Nationality = "Việt Nam", Dob = new DateOnly(1990, 4, 4) },
                    new Person { Id = "p5", FullName = "Robert Downey Jr", Slug = "rdj", Nationality = "Mỹ", Dob = new DateOnly(1965, 4, 4) }
                );
                await context.SaveChangesAsync();
            }

            // 4. Movies
            if (!await context.Movies.AnyAsync())
            {
                context.Movies.AddRange(
                    new Movie { Id = 1, Title = "Mai", Slug = "mai", Description = "Phim của Trấn Thành", ReleaseYear = 2024, Status = 1 },
                    new Movie { Id = 2, Title = "Oppenheimer", Slug = "oppenheimer", Description = "Bom tấn của Nolan", ReleaseYear = 2023, Status = 1 },
                    new Movie { Id = 3, Title = "Inception", Slug = "inception", Description = "Kẻ trộm giấc mơ", ReleaseYear = 2010, Status = 1 },
                    new Movie { Id = 4, Title = "Iron Man", Slug = "iron-man", Description = "Người sắt", ReleaseYear = 2008, Status = 1 },
                    new Movie { Id = 5, Title = "Gặp Lại Chị Bầu", Slug = "gap-lai-chi-bau", Description = "Phim Tết 2024", ReleaseYear = 2024, Status = 1 }
                );
                await context.SaveChangesAsync();
            }

            // 5. Users
            if (!await context.Users.AnyAsync())
            {
                context.Users.AddRange(
                    new User { UserId = "u1", Email = "admin@tvien.com", DisplayName = "Admin TviEn", GoogleId = "g1", RoleId = 1 },
                    new User { UserId = "u2", Email = "vip1@gmail.com", DisplayName = "Khách hàng VIP", GoogleId = "g2", RoleId = 2 },
                    new User { UserId = "u3", Email = "member@gmail.com", DisplayName = "Thành viên mới", GoogleId = "g3", RoleId = 3 },
                    new User { UserId = "u4", Email = "user4@gmail.com", DisplayName = "Trung Trần", GoogleId = "g4", RoleId = 3 },
                    new User { UserId = "u5", Email = "test@gmail.com", DisplayName = "Tester", GoogleId = "g5", RoleId = 3 }
                );
                await context.SaveChangesAsync();
            }

            // 6. Junctions (Gán linh tinh cho vui)
            if (!await context.MovieGenres.AnyAsync())
            {
                var movies = await context.Movies.ToListAsync();
                var genres = await context.Genres.ToListAsync();
                
                if (movies.Count >= 5 && genres.Count >= 7)
                {
                    context.MovieGenres.AddRange(
                        new MovieGenre { MovieId = movies[0].Id, GenreId = genres[1].GenreId }, // Phim 1 - Tình cảm
                        new MovieGenre { MovieId = movies[1].Id, GenreId = genres[4].GenreId }, // Phim 2 - Sci-fi
                        new MovieGenre { MovieId = movies[2].Id, GenreId = genres[0].GenreId }, // Phim 3 - Hành động
                        new MovieGenre { MovieId = movies[3].Id, GenreId = genres[4].GenreId }, // Phim 4 - Sci-fi
                        new MovieGenre { MovieId = movies[4].Id, GenreId = genres[3].GenreId }, // Phim 5 - Hài
                        new MovieGenre { MovieId = movies[0].Id, GenreId = genres[6].GenreId }, // Phim 1 (Mai) - Phim thương mại
                        new MovieGenre { MovieId = movies[1].Id, GenreId = genres[5].GenreId }, // Phim 2 (Oppenheimer) - Phim độc lập
                        new MovieGenre { MovieId = movies[2].Id, GenreId = genres[6].GenreId }, // Phim 3 (Inception) - Phim thương mại
                        new MovieGenre { MovieId = movies[4].Id, GenreId = genres[5].GenreId }  // Phim 5 (Gặp Lại Chị Bầu) - Phim độc lập
                    );
                    await context.SaveChangesAsync();
                }
            }

            if (!await context.MovieCrews.AnyAsync())
            {
                var movies = await context.Movies.ToListAsync();
                var persons = await context.Persons.ToListAsync();

                if (movies.Count >= 5 && persons.Count >= 5)
                {
                    context.MovieCrews.AddRange(
                        new MovieCrew { MovieId = movies[0].Id, PersonId = persons[0].Id, RoleId = 1 }, // Director
                        new MovieCrew { MovieId = movies[1].Id, PersonId = persons[1].Id, RoleId = 1 }, // Director
                        new MovieCrew { MovieId = movies[1].Id, PersonId = persons[2].Id, RoleId = 2, CharacterName = "Lead" },
                        new MovieCrew { MovieId = movies[3].Id, PersonId = persons[4].Id, RoleId = 2, CharacterName = "Hero" },
                        new MovieCrew { MovieId = movies[4].Id, PersonId = persons[3].Id, RoleId = 2, CharacterName = "Supporting" }
                    );
                    await context.SaveChangesAsync();
                }
            }

            // 7. Videos (Để xem được phim ngay lập tức)
            if (!await context.Videos.AnyAsync())
            {
                var movies = await context.Movies.ToListAsync();
                foreach (var m in movies)
                {
                    context.Videos.Add(new Video {
                        VideoId = Guid.NewGuid(),
                        MovieId = m.Id,
                        MasterPlaylistUrl = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8", // Video demo m3u8 cực xịn
                        Resolution = "1080p",
                        IsDeleted = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                await context.SaveChangesAsync();
            }
        }
    }
}
