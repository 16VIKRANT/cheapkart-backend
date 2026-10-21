const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const configured = Boolean(
  process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY && process.env.SES_FROM_EMAIL,
);

const ses = configured ? new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}) : null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function sendEmail({ to, subject, text, html }) {
  if (!ses) throw new Error('Amazon SES is not configured');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(process.env.SES_FROM_EMAIL || '')) {
    throw new Error('SES_FROM_EMAIL must be a plain email address in name@domain format');
  }
  await ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Charset: 'UTF-8', Data: subject },
      Body: {
        Text: { Charset: 'UTF-8', Data: text },
        Html: { Charset: 'UTF-8', Data: html },
      },
    },
  }));
}

function emailConfigured() { return configured; }
module.exports = { sendEmail, emailConfigured, escapeHtml };
