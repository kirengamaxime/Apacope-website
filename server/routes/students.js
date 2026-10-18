const router = require('express').Router();
const { Student, Parent, User } = require('../models');
const { protect, authorize, visibleStudentIds } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, paging } = require('../utils/helpers');

router.use(protect);

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// List students (privacy scoped: parents see own children, students see themselves)
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 25);
  const q = {};
  const ids = await visibleStudentIds(req.user);
  if (ids) q._id = { $in: ids };
  if (req.query.class) q.class = req.query.class;
  if (req.query.status) q.status = req.query.status;
  if (req.query.search) {
    const r = new RegExp(esc(req.query.search), 'i');
    q.$or = [{ firstName: r }, { lastName: r }, { admissionNo: r }];
  }
  const [items, total] = await Promise.all([
    Student.find(q).populate({ path: 'class', populate: 'trade' }).sort({ lastName: 1 }).skip(skip).limit(limit),
    Student.countDocuments(q),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

router.get('/:id', wrap(async (req, res) => {
  const ids = await visibleStudentIds(req.user);
  if (ids && !ids.some((i) => String(i) === req.params.id)) return res.status(403).json({ message: 'Not allowed' });
  const s = await Student.findById(req.params.id).populate({ path: 'class', populate: 'trade' }).populate({ path: 'parents', populate: 'user' });
  if (!s) return res.status(404).json({ message: 'Not found' });
  res.json(s);
}));

router.post('/', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const s = await Student.create(req.body);
  await audit(req, 'STUDENT_CREATE', 'Student', s._id, { admissionNo: s.admissionNo });
  res.status(201).json(s);
}));

router.put('/:id', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const s = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!s) return res.status(404).json({ message: 'Not found' });
  await audit(req, 'STUDENT_UPDATE', 'Student', s._id);
  res.json(s);
}));

router.delete('/:id', authorize('headteacher'), wrap(async (req, res) => {
  await Student.findByIdAndUpdate(req.params.id, { status: 'dropped' });
  await audit(req, 'STUDENT_REMOVE', 'Student', req.params.id);
  res.json({ message: 'Student marked as dropped' });
}));

/** Link a parent account to a student. Creates the Parent profile if needed. */
router.post('/:id/link-parent', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const { userId, relationship } = req.body;
  const user = await User.findById(userId);
  if (!user || user.role !== 'parent') return res.status(400).json({ message: 'User must have the parent role' });
  let parent = await Parent.findOne({ user: userId });
  if (!parent) parent = await Parent.create({ user: userId, relationship, children: [] });
  await Parent.updateOne({ _id: parent._id }, { $addToSet: { children: req.params.id } });
  await Student.updateOne({ _id: req.params.id }, { $addToSet: { parents: parent._id } });
  await audit(req, 'PARENT_LINK', 'Student', req.params.id, { parent: userId });
  res.json({ message: 'Parent linked' });
}));

module.exports = router;
