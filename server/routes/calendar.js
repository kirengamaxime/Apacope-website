const router = require('express').Router();
const { Timetable, Event, Student, Announcement, Parent } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap } = require('../utils/helpers');

router.use(protect);

/* ----- Timetable ----- */
router.get('/timetable', wrap(async (req, res) => {
  const q = {};
  if (req.query.class) q.class = req.query.class;
  if (req.user.role === 'student') {
    const s = await Student.findOne({ user: req.user._id });
    q.class = s?.class;
  } else if (req.user.role === 'parent') {
    const p = await Parent.findOne({ user: req.user._id }).populate('children', 'class');
    q.class = req.query.class && (p?.children || []).some((c) => String(c.class) === req.query.class)
      ? req.query.class : { $in: (p?.children || []).map((c) => c.class) };
  } else if (req.user.role === 'trainer' && req.query.mine === 'true') {
    q.trainer = req.user._id;
  }
  res.json(await Timetable.find(q).populate('class', 'name').populate('module', 'name').populate('trainer', 'name').sort({ day: 1, startTime: 1 }));
}));

router.post('/timetable', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const clash = await Timetable.findOne({
    day: req.body.day, startTime: req.body.startTime,
    $or: [{ trainer: req.body.trainer }, { room: req.body.room, class: { $ne: req.body.class } }, { class: req.body.class }],
  });
  if (clash) return res.status(409).json({ message: 'Clash: trainer, room or class already booked for that slot' });
  const t = await Timetable.create(req.body);
  await audit(req, 'TIMETABLE_CREATE', 'Timetable', t._id);
  res.status(201).json(t);
}));

router.put('/timetable/:id', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const t = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await audit(req, 'TIMETABLE_UPDATE', 'Timetable', t._id);
  // notify the affected class about the change
  await Announcement.create({
    title: 'Timetable updated', kind: 'class-message', author: req.user._id, classes: [t.class],
    body: 'The timetable for your class has changed. Please check the Timetable page.',
    audienceRoles: ['student', 'parent', 'trainer'],
  });
  res.json(t);
}));

router.delete('/timetable/:id', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const t = await Timetable.findByIdAndDelete(req.params.id);
  if (t) {
    await Announcement.create({
      title: 'Timetable updated', kind: 'class-message', author: req.user._id, classes: [t.class],
      body: 'A lesson was removed from your timetable.', audienceRoles: ['student', 'parent', 'trainer'],
    });
  }
  await audit(req, 'TIMETABLE_DELETE', 'Timetable', req.params.id);
  res.json({ message: 'Deleted' });
}));

/* ----- Calendar events ----- */
router.get('/events', wrap(async (req, res) => {
  const q = {};
  if (req.query.from || req.query.to) {
    q.start = {};
    if (req.query.from) q.start.$gte = new Date(req.query.from);
    if (req.query.to) q.start.$lte = new Date(req.query.to);
  }
  res.json(await Event.find(q).sort({ start: 1 }).limit(300));
}));
router.post('/events', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const e = await Event.create({ ...req.body, createdBy: req.user._id });
  await audit(req, 'EVENT_CREATE', 'Event', e._id, { title: e.title });
  res.status(201).json(e);
}));
router.put('/events/:id', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const e = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await audit(req, 'EVENT_UPDATE', 'Event', req.params.id);
  res.json(e);
}));
router.delete('/events/:id', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  await audit(req, 'EVENT_DELETE', 'Event', req.params.id);
  res.json({ message: 'Deleted' });
}));

module.exports = router;
