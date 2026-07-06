using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTviEn.Migrations
{
    /// <inheritdoc />
    public partial class AddIsIndieToMovies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsIndie",
                table: "Movies",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsIndie",
                table: "Movies");
        }
    }
}
