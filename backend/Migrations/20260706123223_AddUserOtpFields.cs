using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTviEn.Migrations
{
    /// <inheritdoc />
    public partial class AddUserOtpFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FailedOtpAttempts",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastForgotPasswordRequest",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ResetPasswordOtp",
                table: "Users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResetPasswordOtpExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailedOtpAttempts",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastForgotPasswordRequest",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ResetPasswordOtp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ResetPasswordOtpExpiry",
                table: "Users");
        }
    }
}
