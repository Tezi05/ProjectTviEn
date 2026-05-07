using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using ProjectTviEn.Models;
using Microsoft.Extensions.Configuration;
using System.IO;

var builder = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json");
var config = builder.Build();

var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
optionsBuilder.UseNpgsql(config.GetConnectionString("DefaultConnection"));

using var context = new AppDbContext(optionsBuilder.Options);

var corruptedMovies = context.Movies
    .Where(m => m.PosterUrl.StartsWith("http") || m.BackdropUrl.StartsWith("http"))
    .ToList();

Console.WriteLine($"Found {corruptedMovies.Count} corrupted movies.");

foreach (var m in corruptedMovies)
{
    if (m.PosterUrl != null && m.PosterUrl.StartsWith("http"))
    {
        var parts = m.PosterUrl.Split("tvien-media-raw/");
        if (parts.Length > 1) {
            m.PosterUrl = parts[1].Split("?")[0];
            Console.WriteLine($"Fixed PosterUrl: {m.PosterUrl}");
        }
    }
    if (m.BackdropUrl != null && m.BackdropUrl.StartsWith("http"))
    {
        var parts = m.BackdropUrl.Split("tvien-media-raw/");
        if (parts.Length > 1) {
            m.BackdropUrl = parts[1].Split("?")[0];
            Console.WriteLine($"Fixed BackdropUrl: {m.BackdropUrl}");
        }
    }
}

context.SaveChanges();
Console.WriteLine("Cleanup complete.");
