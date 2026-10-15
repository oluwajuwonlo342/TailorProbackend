const axios = require('axios');

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Sends a transactional email through Brevo's HTTP API (works on Render's free tier, unlike SMTP)
const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM;

  if (!apiKey || !senderEmail) {
    throw new Error('Email is not configured: set BREVO_API_KEY and EMAIL_FROM.');
  }

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: process.env.EMAIL_FROM_NAME || 'TailorPro', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      timeout: 15000
    }
  );
};

module.exports = { sendEmail, escapeHtml };
