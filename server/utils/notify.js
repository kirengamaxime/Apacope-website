/**
 * Optional SMS / Email integration hook.
 * Replace the body of `notify` with a call to your provider
 * (e.g. Africa's Talking or Twilio for SMS, Nodemailer for email).
 * It is called after announcements and parent alerts are created.
 */
function notify(payload) {
  if (process.env.NOTIFY_DEBUG === 'true') console.log('[notify hook]', payload);
  // return sendSms(...) / sendEmail(...)
}

module.exports = { notify };
