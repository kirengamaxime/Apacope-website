const router = require('express').Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const { protect, signToken } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap } = require('../utils/helpers');
const { mailConfigured, sendResetEmail } = require('../utils/mailer');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts, try again later' } });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone, mustChangePassword: !!u.mustChangePassword });

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Email and password required' });
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.active || !(await user.matches(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  user.lastLogin = new Date();
  await user.save();
  req.user = user;
  await audit(req, 'LOGIN', 'User', user._id);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/change-password', protect, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matches(currentPassword || ''))) return res.status(400).json({ message: 'Current password is incorrect' });
  if (newPassword === currentPassword) return res.status(400).json({ message: 'Choose a different password from the current one' });
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  await audit(req, 'PASSWORD_CHANGE', 'User', user._id);
  res.json({ message: 'Password updated' });
}));

/** Password reset: issues a token (emailed through your mail hook in production). */
router.post('/forgot-password', loginLimiter, wrap(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  const response = { message: 'If that email exists, a reset link has been sent.' };
  if (user) {
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const link = `${(process.env.CLIENT_URL || '').replace(/\/$/, '')}/reset-password/${raw}`;
    if (mailConfigured()) {
      try { await sendResetEmail(user, link); } catch (e) { console.error('[password reset] email failed:', e.message); }
    } else {
      console.warn('[password reset] SMTP not configured, email not sent. Set SMTP_* in .env.');
      console.log(`[password reset] ${user.email}: ${link}`);
      if (process.env.NODE_ENV !== 'production') response.devLink = link;
    }
  }
  res.json(response);
}));

router.post('/reset-password/:token', wrap(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ resetToken: hash, resetExpires: { $gt: new Date() } }).select('+resetToken +resetExpires');
  if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });
  if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  user.password = req.body.password;
  user.resetToken = undefined;
  user.resetExpires = undefined;
  user.mustChangePassword = false;
  await user.save();
  req.user = user;
  await audit(req, 'PASSWORD_RESET', 'User', user._id);
  res.json({ message: 'Password reset. You can now sign in.' });
}));

module.exports = router;
