using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security;

namespace ProjectTviEn.Services
{
    public class GmailEmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<GmailEmailService> _logger;

        public GmailEmailService(IConfiguration config, ILogger<GmailEmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var smtpServer = _config["Email:SmtpServer"] ?? "smtp.gmail.com";
            var portStr = _config["Email:Port"] ?? "587";
            int.TryParse(portStr, out int port);
            if (port == 0) port = 587;

            var senderName = _config["Email:SenderName"] ?? "TviEn Movie";
            var senderEmail = _config["Email:SenderEmail"] ?? "";
            var senderPassword = _config["Email:SenderPassword"] ?? "";

            // LOG first as fallback in case SMTP fails/is not configured
            _logger.LogInformation("=========================================");
            _logger.LogInformation($"[FORGOT PASSWORD EMAIL SENT]");
            _logger.LogInformation($"To: {toEmail}");
            _logger.LogInformation($"Subject: {subject}");
            _logger.LogInformation($"Body:\n{body}");
            _logger.LogInformation("=========================================");

            if (string.IsNullOrEmpty(senderEmail) || string.IsNullOrEmpty(senderPassword))
            {
                _logger.LogWarning("SMTP Gmail email/password is not configured. Email not sent via network, but logged above.");
                return;
            }

            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(senderName, senderEmail));
                message.To.Add(new MailboxAddress("", toEmail));
                message.Subject = subject;

                var bodyBuilder = new BodyBuilder { HtmlBody = body };
                message.Body = bodyBuilder.ToMessageBody();

                using (var client = new SmtpClient())
                {
                    await client.ConnectAsync(smtpServer, port, SecureSocketOptions.StartTls);
                    await client.AuthenticateAsync(senderEmail, senderPassword);
                    await client.SendAsync(message);
                    await client.DisconnectAsync(true);
                }

                _logger.LogInformation($"Successfully sent email to {toEmail} via SMTP.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send email to {toEmail} via SMTP.");
                throw;
            }
        }
    }
}
