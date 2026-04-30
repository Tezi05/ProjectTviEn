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
                    new Genre { Name = "Khoa học viễn tưởng", Slug = "sci-fi" }
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
                    new Movie { Id = "m1", Title = "Mai", Slug = "mai", Description = "Phim của Trấn Thành", ReleaseYear = 2024 },
                    new Movie { Id = "m2", Title = "Oppenheimer", Slug = "oppenheimer", Description = "Bom tấn của Nolan", ReleaseYear = 2023 },
                    new Movie { Id = "m3", Title = "Inception", Slug = "inception", Description = "Kẻ trộm giấc mơ", ReleaseYear = 2010 },
                    new Movie { Id = "m4", Title = "Iron Man", Slug = "iron-man", Description = "Người sắt", ReleaseYear = 2008 },
                    new Movie { Id = "m5", Title = "Gặp Lại Chị Bầu", Slug = "gap-lai-chi-bau", Description = "Phim Tết 2024", ReleaseYear = 2024 }
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
                var genres = await context.Genres.ToListAsync();
                context.MovieGenres.AddRange(
                    new MovieGenre { MovieId = "m1", GenreId = genres[1].GenreId }, // Mai - Tình cảm
                    new MovieGenre { MovieId = "m2", GenreId = genres[4].GenreId }, // Oppenheimer - Sci-fi
                    new MovieGenre { MovieId = "m3", GenreId = genres[0].GenreId }, // Inception - Hành động
                    new MovieGenre { MovieId = "m4", GenreId = genres[4].GenreId }, // Iron Man - Sci-fi
                    new MovieGenre { MovieId = "m5", GenreId = genres[3].GenreId }  // Chị Bầu - Hài
                );
                await context.SaveChangesAsync();
            }

            if (!await context.MovieCrews.AnyAsync())
            {
                context.MovieCrews.AddRange(
                    new MovieCrew { MovieId = "m1", PersonId = "p1", Role = "Director" }, // Trấn Thành đạo diễn Mai
                    new MovieCrew { MovieId = "m2", PersonId = "p2", Role = "Director" }, // Nolan đạo diễn Oppenheimer
                    new MovieCrew { MovieId = "m2", PersonId = "p3", Role = "Actor", CharacterName = "J. Robert Oppenheimer" },
                    new MovieCrew { MovieId = "m4", PersonId = "p5", Role = "Actor", CharacterName = "Tony Stark" },
                    new MovieCrew { MovieId = "m5", PersonId = "p4", Role = "Actor", CharacterName = "Huyền" }
                );
                await context.SaveChangesAsync();
            }
        }
    }
}
