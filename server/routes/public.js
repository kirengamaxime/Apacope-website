const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { Event, ContactMessage } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { wrap, paging, startOfDay } = require('../utils/helpers');
const { notify } = require('../utils/notify');

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, message: { message: 'Too many messages. Please try again later.' } });

/** Public: upcoming school events for the landing page (no login needed) */
router.get('/events', wrap(async (req, res) => {
  const events = await Event.find({ start: { $gte: startOfDay() } })
    .sort({ start: 1 }).limit(6).select('title type start end description');
  res.json(events);
}));

/** Public: contact / admission enquiry form */
router.post('/contact', contactLimiter, wrap(async (req, res) => {
  const { name, email, phone, topic, message } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof message !== 'string' || message.trim().length < 5) {
    return res.status(400).json({ message: 'Please enter your name and a message.' });
  }
  if (!email && !phone) return res.status(400).json({ message: 'Please give an email or a phone number so we can reply.' });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'That email address looks wrong.' });
  const doc = await ContactMessage.create({
    name, email: email || undefined, phone: phone || undefined,
    topic: ['admission', 'general', 'fees', 'other'].includes(topic) ? topic : 'general', message,
  });
  notify({ type: 'contact', name: doc.name, topic: doc.topic });
  res.status(201).json({ message: 'Thank you! The school office will contact you soon.' });
}));

/** Staff: read enquiries */
router.get('/messages', protect, authorize('headteacher', 'dos'), wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 20);
  const [items, total, unread] = await Promise.all([
    ContactMessage.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(),
    ContactMessage.countDocuments({ read: false }),
  ]);
  res.json({ items, total, unread, page, pages: Math.ceil(total / limit) });
}));

router.put('/messages/:id/read', protect, authorize('headteacher', 'dos'), wrap(async (req, res) => {
  res.json(await ContactMessage.findByIdAndUpdate(req.params.id, { read: req.body.read !== false }, { new: true }));
}));

module.exports = router;
