const nodemailer = require('nodemailer');

const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport;
const getTransport = () => {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
};

async function sendResetEmail(user, link) {
  const from = process.env.MAIL_FROM || `Groupe Scolaire APACOPE <${process.env.SMTP_USER}>`;
  const text = `Hello ${user.name},\n\nOpen this link within 30 minutes to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.\n\nGroupe Scolaire APACOPE`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#0e2238"><h2>Reset your password</h2><p>Hello ${String(user.name).replace(/</g, '&lt;')},</p><p>The link below works for 30 minutes.</p><p><a href="${link}" style="display:inline-block;background:#c81e25;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="font-size:13px;color:#5b6a7c">${link}</p></div>`;
  return getTransport().sendMail({ from, to: user.email, subject: 'Reset your APACOPE portal password', text, html });
}

module.exports = { mailConfigured, sendResetEmail };