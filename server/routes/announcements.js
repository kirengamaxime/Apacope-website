const router = require('express').Router();
const { Announcement, Student, Parent } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { notify } = require('../utils/notify');
const { wrap, paging } = require('../utils/helpers');

router.use(protect);

/** What the current user is allowed to read */
async function audienceFilter(user) {
  if (['admin', 'headteacher', 'dos'].includes(user.role)) return {};
  const or = [{ schoolWide: true }, { audienceRoles: user.role }, { author: user._id }];
  if (user.role === 'student') {
    const s = await Student.findOne({ user: user._id });
    if (s) or.push({ classes: s.class });
  }
  if (user.role === 'parent') {
    const p = await Parent.findOne({ user: user._id }).populate('children', 'class');
    const classIds = (p?.children || []).map((c) => c.class);
    if (classIds.length) or.push({ classes: { $in: classIds }, audienceRoles: 'parent' });
    // parent alerts only for their own children
    const childIds = (p?.children || []).map((c) => c._id);
    return { $and: [{ $or: or }, { $or: [{ forStudent: { $exists: false } }, { forStudent: null }, { forStudent: { $in: childIds } }] }] };
  }
  return { $or: or };
}

router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 15);
  const q = await audienceFilter(req.user);
  const [items, total] = await Promise.all([
    Announcement.find(q).populate('author', 'name role').populate('classes', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Announcement.countDocuments(q),
  ]);
  const mine = items.map((a) => {
    const o = a.toObject();
    o.acknowledged = a.acknowledgements.some((x) => String(x.user) === String(req.user._id));
    o.ackCount = a.acknowledgements.length;
    if (!['admin', 'headteacher', 'dos'].includes(req.user.role) && String(a.author._id) !== String(req.user._id)) delete o.acknowledgements;
    return o;
  });
  res.json({ items: mine, total, page, pages: Math.ceil(total / limit) });
}));

// Official announcements: head teacher / DOS. Class messages: trainers.
router.post('/', authorize('headteacher', 'dos', 'trainer'), wrap(async (req, res) => {
  const { title, body, audienceRoles = [], schoolWide = false, classes = [], requiresAck = false } = req.body;
  const isClassMsg = req.user.role === 'trainer';
  if (isClassMsg && !classes.length) return res.status(400).json({ message: 'Choose at least one class' });
  const a = await Announcement.create({
    title, body, requiresAck,
    author: req.user._id,
    kind: isClassMsg ? 'class-message' : 'announcement',
    schoolWide: isClassMsg ? false : schoolWide,
    audienceRoles: isClassMsg ? ['student', 'parent'] : audienceRoles,
    classes,
  });
  await audit(req, 'ANNOUNCEMENT_CREATE', 'Announcement', a._id, { title, schoolWide });
  notify({ type: 'announcement', title, body }); // optional SMS/email hook
  res.status(201).json(a);
}));

// Acknowledge (read receipt)
router.post('/:id/ack', wrap(async (req, res) => {
  const a = await Announcement.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!a.acknowledgements.some((x) => String(x.user) === String(req.user._id))) {
    a.acknowledgements.push({ user: req.user._id });
    await a.save();
  }
  res.json({ acknowledged: true });
}));

router.delete('/:id', authorize('headteacher', 'dos'), wrap(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  await audit(req, 'ANNOUNCEMENT_DELETE', 'Announcement', req.params.id);
  res.json({ message: 'Deleted' });
}));

module.exports = router;
