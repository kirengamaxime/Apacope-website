const router = require('express').Router();
const crypto = require('crypto');
const { User, Role, AuditLog, Student, Parent, Assignment, Timetable, Loan, Class, ROLES } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, paging } = require('../utils/helpers');

router.use(protect);

// List users (admin, head teacher can view)
router.get('/', authorize('headteacher', 'dos'), wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = {};
  if (req.query.role) q.role = req.query.role;
  if (req.query.search) q.name = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    User.find(q).sort({ name: 1 }).skip(skip).limit(limit),
    User.countDocuments(q),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

// Light list for dropdowns (trainers, etc.)
router.get('/lookup', authorize('headteacher', 'dos', 'trainer', 'librarian', 'accountant'), wrap(async (req, res) => {
  const q = { active: true };
  if (req.query.role) q.role = req.query.role;
  res.json(await User.find(q).select('name role email').sort({ name: 1 }).limit(200));
}));

/** One-time password: readable, no look-alike characters (0/O, 1/l/I) */
const tempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join('');
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
};
const activeAdmins = (excludeId) => User.countDocuments({ role: 'admin', active: true, _id: { $ne: excludeId } });

// Create an account. System Administrator only. Without a password a one-time one is generated.
router.post('/', authorize(), wrap(async (req, res) => {
  const { name, email, role, phone, studentId } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });
  const password = req.body.password || tempPassword();
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  if (role === 'student' && studentId) {
    const st = await Student.findById(studentId);
    if (!st) return res.status(400).json({ message: 'Student record not found' });
    if (st.user) return res.status(400).json({ message: 'That student already has a login' });
  }
  const user = await User.create({ name, email, password, role, phone, mustChangePassword: true, createdBy: req.user._id });
  if (role === 'student' && studentId) await Student.findByIdAndUpdate(studentId, { user: user._id });
  await audit(req, 'USER_CREATE', 'User', user._id, { email: user.email, role });
  res.status(201).json({ user, tempPassword: password });
}));

router.put('/:id', authorize(), wrap(async (req, res) => {
  const { name, phone, role, active } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  const self = String(req.user._id) === String(user._id);
  const losesAdmin = user.role === 'admin' && ((role && role !== 'admin') || active === false);
  if (losesAdmin && (self || (await activeAdmins(user._id)) === 0)) {
    return res.status(400).json({ message: 'The last active System Administrator cannot be demoted or disabled' });
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role && ROLES.includes(role)) user.role = role;
  if (active !== undefined) user.active = !!active;
  await user.save();
  await audit(req, 'USER_UPDATE', 'User', user._id, { role, active });
  res.json(user);
}));

// Reset a forgotten password: new one-time password, shown once to the administrator
router.post('/:id/reset-password', authorize(), wrap(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  const password = tempPassword();
  user.password = password;
  user.mustChangePassword = true;
  await user.save();
  await audit(req, 'USER_PASSWORD_RESET', 'User', user._id);
  res.json({ user, tempPassword: password });
}));

// Permanently delete an account. (To only block a login, use Edit and untick "Account active".)
router.delete('/:id', authorize(), wrap(async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'Not found' });
  if (String(req.user._id) === String(target._id)) return res.status(400).json({ message: 'You cannot delete your own account' });
  if (target.role === 'admin' && target.active && (await activeAdmins(target._id)) === 0) {
    return res.status(400).json({ message: 'The last active System Administrator cannot be deleted' });
  }
  const [lessons, slots, loans] = await Promise.all([
    Assignment.countDocuments({ trainer: target._id }),
    Timetable.countDocuments({ trainer: target._id }),
    Loan.countDocuments({ borrower: target._id, returnedAt: { $exists: false } }),
  ]);
  if (lessons || slots) return res.status(400).json({ message: `${target.name} is still assigned to ${lessons} class module(s) and ${slots} timetable slot(s). Reassign or remove those first, or disable the account instead.` });
  if (loans) return res.status(400).json({ message: `${target.name} still has ${loans} item(s) on loan. Record the return first.` });
  // tidy links: student login, parent profile, class teacher
  await Student.updateMany({ user: target._id }, { $unset: { user: 1 } });
  const parent = await Parent.findOne({ user: target._id });
  if (parent) {
    await Student.updateMany({ parents: parent._id }, { $pull: { parents: parent._id } });
    await parent.deleteOne();
  }
  await Class.updateMany({ classTeacher: target._id }, { $unset: { classTeacher: 1 } });
  await target.deleteOne();
  await audit(req, 'USER_DELETE', 'User', target._id, { email: target.email, role: target.role });
  res.json({ message: 'User deleted' });
}));

// Role permission sets
router.get('/roles/all', authorize(), wrap(async (req, res) => res.json(await Role.find())));
router.put('/roles/:name', authorize(), wrap(async (req, res) => {
  const role = await Role.findOneAndUpdate(
    { name: req.params.name },
    { permissions: req.body.permissions || [], label: req.body.label },
    { upsert: true, new: true },
  );
  await audit(req, 'ROLE_UPDATE', 'Role', role._id, { permissions: role.permissions });
  res.json(role);
}));

// Audit logs
router.get('/audit/logs', authorize('headteacher'), wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 30);
  const q = {};
  if (req.query.action) q.action = req.query.action;
  if (req.query.user) q.user = req.query.user;
  const [items, total] = await Promise.all([
    AuditLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(q),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

module.exports = router;