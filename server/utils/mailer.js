const nodemailer = require('nodemailer');

/** True when SMTP settings are present in .env */
const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport;
const getTransport = () => {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
};

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || `Groupe Scolaire APACOPE <${process.env.SMTP_USER}>`;
  return getTransport().sendMail({ from, to, subject, text, html });
}

async function sendResetEmail(user, link) {
  const text = `Hello ${user.name},\n\nWe received a request to reset your school portal password.\nOpen this link within 30 minutes to choose a new one:\n\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n\nGroupe Scolaire APACOPE`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;color:#0e2238">
    <h2 style="margin:0 0 12px">Reset your password</h2>
    <p>Hello ${String(user.name).replace(/</g, '&lt;')},</p>
    <p>We received a request to reset your school portal password. The link below works for 30 minutes.</p>
    <p><a href="${link}" style="display:inline-block;background:#c81e25;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
    <p style="font-size:13px;color:#5b6a7c">If the button does not work, copy this address into your browser:<br>${link}</p>
    <p style="font-size:13px;color:#5b6a7c">If you did not ask for this, ignore this email; your password stays the same.</p>
    <p style="font-size:13px;color:#5b6a7c">Groupe Scolaire APACOPE</p></div>`;
  return sendMail({ to: user.email, subject: 'Reset your APACOPE portal password', text, html });
}

module.exports = { mailConfigured, sendMail, sendResetEmail };
