using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTviEn.Migrations
{
    /// <inheritdoc />
    public partial class AddEpisodeIdToMediaAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EpisodeId",
                table: "MediaAssets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EpisodeId",
                table: "IngestJobs",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EpisodeId",
                table: "MediaAssets");

            migrationBuilder.DropColumn(
                name: "EpisodeId",
                table: "IngestJobs");
        }
    }
}
