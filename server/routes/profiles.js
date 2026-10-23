const router = require('express').Router();
const {
  Student, User, Parent, Attendance, Assessment, Invoice, Payment, Assignment, Timetable, Class, Loan, AuditLog,
} = require('../models');
const { protect, visibleStudentIds } = require('../middleware/auth');
const { wrap, gradeFor, pct } = require('../utils/helpers');

router.use(protect);

/** Everything about one learner on a single page (privacy scoped like the rest of the system) */
router.get('/student/:id', wrap(async (req, res) => {
  const ids = await visibleStudentIds(req.user);
  if (ids && !ids.some((i) => String(i) === req.params.id)) return res.status(403).json({ message: 'Not allowed' });
  const s = await Student.findById(req.params.id)
    .populate({ path: 'class', populate: 'trade' })
    .populate({ path: 'parents', populate: { path: 'user', select: 'name email phone' } })
    .populate('user', 'email lastLogin active');
  if (!s) return res.status(404).json({ message: 'Not found' });

  // attendance
  const rows = await Attendance.aggregate([{ $match: { student: s._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const att = { present: 0, absent: 0, late: 0, excused: 0 };
  rows.forEach((r) => { att[r._id] = r.n; });
  const total = att.present + att.absent + att.late + att.excused;
  const attendance = {
    ...att, total, rate: pct(att.present + att.late + att.excused, total),
    recentAbsences: await Attendance.find({ student: s._id, status: 'absent' }).sort({ date: -1 }).limit(8).select('date session note'),
  };

  // results
  const marks = await Assessment.find({ student: s._id }).populate('module', 'name code');
  const byModule = {};
  marks.forEach((r) => {
    const key = String(r.module?._id);
    byModule[key] ||= { module: r.module?.name, code: r.module?.code, total: 0, max: 0, count: 0 };
    byModule[key].total += r.score; byModule[key].max += r.maxScore; byModule[key].count += 1;
  });
  const modules = Object.values(byModule).map((m) => {
    const percentage = m.max ? Math.round((m.total / m.max) * 1000) / 10 : 0;
    return { ...m, percentage, ...gradeFor(percentage), competent: percentage >= 70 };
  });
  const average = modules.length ? Math.round((modules.reduce((t, m) => t + m.percentage, 0) / modules.length) * 10) / 10 : 0;
  const results = { modules, average, ...gradeFor(average), hasMarks: modules.length > 0 };

  // fees: only finance staff, head teacher, admin, or the learner's own family
  const seesFinance = !!ids || ['accountant', 'headteacher', 'admin'].includes(req.user.role);
  let finance = null;
  if (seesFinance) {
    const [invoices, payments] = await Promise.all([
      Invoice.find({ student: s._id }).sort({ createdAt: -1 }),
      Payment.find({ student: s._id }).sort({ createdAt: -1 }).limit(8),
    ]);
    const billed = invoices.reduce((t, i) => t + i.amount, 0);
    const paid = invoices.reduce((t, i) => t + i.paid, 0);
    finance = { billed, paid, balance: billed - paid, invoices, payments };
  }

  res.json({ student: s, attendance, results, finance });
}));

/** A staff member's workload and activity. Admin, head teacher and DOS can open anyone; everyone can open their own. */
router.get('/staff/:id', wrap(async (req, res) => {
  const self = String(req.user._id) === req.params.id;
  if (!self && !['admin', 'headteacher', 'dos'].includes(req.user.role)) return res.status(403).json({ message: 'Not allowed' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  const seesLog = ['admin', 'headteacher'].includes(req.user.role);
  const [assignments, timetable, classesLed, loans, activity, student, parent] = await Promise.all([
    Assignment.find({ trainer: user._id }).populate('class', 'name level').populate('module', 'name code'),
    Timetable.find({ trainer: user._id }).populate('class', 'name').populate('module', 'name').sort({ day: 1, startTime: 1 }),
    Class.find({ classTeacher: user._id }).select('name level'),
    Loan.find({ borrower: user._id, returnedAt: { $exists: false } }).populate('item', 'name tag'),
    seesLog ? AuditLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(10) : [],
    user.role === 'student' ? Student.findOne({ user: user._id }).select('firstName lastName admissionNo') : null,
    user.role === 'parent' ? Parent.findOne({ user: user._id }).populate('children', 'firstName lastName admissionNo') : null,
  ]);
  res.json({ user, assignments, timetable, classesLed, loans, activity, student, children: parent?.children || [], seesLog });
}));

module.exports = router;