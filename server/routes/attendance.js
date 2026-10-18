const router = require('express').Router();
const mongoose = require('mongoose');
const { Attendance, AttendanceRule, FollowUp, Student, Assignment, Announcement, Parent } = require('../models');
const { protect, authorize, visibleStudentIds } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const {
  wrap, paging, getRules, classifyAbsences, startOfDay, endOfDay, startOfMonth, endOfMonth, pct,
} = require('../utils/helpers');

router.use(protect);
const OID = (id) => new mongoose.Types.ObjectId(String(id));

/** Trainers may only record attendance for classes they are assigned to */
async function canRecord(user, classId) {
  if (['admin', 'dos', 'headteacher'].includes(user.role)) return true;
  if (user.role !== 'trainer') return false;
  return !!(await Assignment.exists({ trainer: user._id, class: classId }));
}

/** Get the register for a class/date/session: students + any existing marks */
router.get('/register', authorize('trainer', 'dos', 'headteacher'), wrap(async (req, res) => {
  const { classId, date, session = 'Full day', moduleId } = req.query;
  if (!classId || !date) return res.status(400).json({ message: 'classId and date are required' });
  if (!(await canRecord(req.user, classId))) return res.status(403).json({ message: 'Not assigned to this class' });
  const d = new Date(date);
  const students = await Student.find({ class: classId, status: 'active' }).sort({ lastName: 1 }).select('firstName lastName admissionNo');
  const q = { class: classId, date: { $gte: startOfDay(d), $lte: endOfDay(d) }, session };
  if (moduleId) q.module = moduleId;
  const existing = await Attendance.find(q);
  const map = Object.fromEntries(existing.map((a) => [String(a.student), { status: a.status, note: a.note }]));
  res.json(students.map((s) => ({
    student: s._id, firstName: s.firstName, lastName: s.lastName, admissionNo: s.admissionNo,
    status: map[String(s._id)]?.status || 'present', note: map[String(s._id)]?.note || '',
    recorded: !!map[String(s._id)],
  })));
}));

/** Save a whole register (bulk upsert). Audited, and triggers absence alerts. */
router.post('/register', authorize('trainer', 'dos', 'headteacher'), wrap(async (req, res) => {
  const { classId, date, session = 'Full day', moduleId, records } = req.body;
  if (!classId || !date || !Array.isArray(records)) return res.status(400).json({ message: 'classId, date and records are required' });
  if (!(await canRecord(req.user, classId))) return res.status(403).json({ message: 'Not assigned to this class' });
  const day = startOfDay(new Date(date));

  const ops = records.map((r) => ({
    updateOne: {
      filter: { student: r.student, date: day, session, module: moduleId || null },
      update: { $set: { class: classId, status: r.status, note: r.note || '', recordedBy: req.user._id } },
      upsert: true,
    },
  }));
  await Attendance.bulkWrite(ops);
  await audit(req, 'ATTENDANCE_SAVE', 'Attendance', classId, {
    date: day, session, count: records.length, absent: records.filter((r) => r.status === 'absent').length,
  });

  // Automated alerting for students marked absent
  const rules = await getRules();
  const alerts = [];
  for (const r of records.filter((x) => x.status === 'absent')) {
    const count = await Attendance.countDocuments({
      student: r.student, status: 'absent', date: { $gte: startOfMonth(day), $lte: endOfMonth(day) },
    });
    const { status, action } = classifyAbsences(count, rules.thresholds);
    if (status !== 'Normal') alerts.push({ student: r.student, absences: count, status, action });
    if (status === 'High Priority' || status === 'Urgent') {
      const stu = await Student.findById(r.student).populate('parents');
      const parentUsers = (stu?.parents || []).map((p) => p.user);
      if (parentUsers.length) {
        const title = `Attendance concern: ${stu.firstName} ${stu.lastName}`;
        const already = await Announcement.findOne({ forStudent: stu._id, kind: 'parent-alert', title, createdAt: { $gte: startOfMonth(day) }, body: new RegExp(`${count} absence`) });
        if (!already) {
          await Announcement.create({
            title, kind: 'parent-alert', author: req.user._id, forStudent: stu._id,
            body: `${stu.firstName} has been absent ${count} absence(s) this month. Please contact the school.`,
            requiresAck: true, audienceRoles: ['parent'],
          });
        }
      }
    }
  }
  res.json({ saved: records.length, alerts });
}));

/** Attendance history query (privacy scoped) */
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 30);
  const q = {};
  const ids = await visibleStudentIds(req.user);
  if (ids) q.student = { $in: ids };
  if (req.query.student && (!ids || ids.some((i) => String(i) === req.query.student))) q.student = req.query.student;
  if (req.query.class) q.class = req.query.class;
  if (req.query.status) q.status = req.query.status;
  if (req.query.from || req.query.to) {
    q.date = {};
    if (req.query.from) q.date.$gte = startOfDay(new Date(req.query.from));
    if (req.query.to) q.date.$lte = endOfDay(new Date(req.query.to));
  }
  const [items, total] = await Promise.all([
    Attendance.find(q).populate('student', 'firstName lastName admissionNo').populate('class', 'name').sort({ date: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(q),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

/** Attendance % per student (privacy scoped) */
router.get('/summary', wrap(async (req, res) => {
  const ids = await visibleStudentIds(req.user);
  const match = {};
  if (ids) match.student = { $in: ids };
  if (req.query.class) match.class = OID(req.query.class);
  const from = req.query.from ? startOfDay(new Date(req.query.from)) : startOfMonth();
  const to = req.query.to ? endOfDay(new Date(req.query.to)) : endOfMonth();
  match.date = { $gte: from, $lte: to };
  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: {
      _id: '$student',
      total: { $sum: 1 },
      present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
      excused: { $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] } },
      absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
    } },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    { $project: { student: { _id: '$s._id', name: { $concat: ['$s.firstName', ' ', '$s.lastName'] }, admissionNo: '$s.admissionNo' }, total: 1, present: 1, late: 1, excused: 1, absent: 1 } },
    { $sort: { 'student.name': 1 } },
  ]);
  res.json(rows.map((r) => ({ ...r, percentage: pct(r.total - r.absent, r.total) })));
}));

/** Absence monitoring table with system status + recommended action */
router.get('/monitoring', authorize('dos', 'headteacher', 'trainer'), wrap(async (req, res) => {
  const rules = await getRules();
  const from = startOfMonth();
  const to = endOfMonth();
  const match = { status: 'absent', date: { $gte: from, $lte: to } };
  if (req.query.class) match.class = OID(req.query.class);
  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: '$student', absences: { $sum: 1 } } },
    { $sort: { absences: -1 } },
    { $limit: 200 },
    { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    { $lookup: { from: 'classes', localField: 's.class', foreignField: '_id', as: 'c' } },
    { $project: { absences: 1, name: { $concat: ['$s.firstName', ' ', '$s.lastName'] }, className: { $arrayElemAt: ['$c.name', 0] } } },
  ]);
  res.json(rows.map((r) => ({ studentId: r._id, name: r.name, className: r.className, absences: r.absences, ...classifyAbsences(r.absences, rules.thresholds) })));
}));

/** Class x weekday heatmap (attendance % for the last N weeks) */
router.get('/heatmap', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const weeks = Math.min(12, parseInt(req.query.weeks) || 4);
  const since = startOfDay(new Date(Date.now() - weeks * 7 * 86400000));
  const rows = await Attendance.aggregate([
    { $match: { date: { $gte: since } } },
    { $group: {
      _id: { class: '$class', dow: { $isoDayOfWeek: '$date' } },
      total: { $sum: 1 },
      attended: { $sum: { $cond: [{ $ne: ['$status', 'absent'] }, 1, 0] } },
    } },
    { $lookup: { from: 'classes', localField: '_id.class', foreignField: '_id', as: 'c' } },
    { $unwind: '$c' },
    { $project: { className: '$c.name', dow: '$_id.dow', total: 1, attended: 1 } },
  ]);
  const classes = [...new Set(rows.map((r) => r.className))].sort();
  const grid = classes.map((c) => ({
    className: c,
    days: [1, 2, 3, 4, 5].map((d) => {
      const cell = rows.find((r) => r.className === c && r.dow === d);
      return cell ? pct(cell.attended, cell.total) : null;
    }),
  }));
  res.json({ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], grid });
}));

/* ---------- configurable rules ---------- */
router.get('/rules', authorize('dos', 'headteacher'), wrap(async (req, res) => res.json(await getRules())));
router.put('/rules', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const rules = await getRules();
  const { thresholds, chronicAbsenceCount, goodAttendancePct, warnAttendancePct } = req.body;
  if (Array.isArray(thresholds)) rules.thresholds = thresholds.map((t) => ({
    minAbsences: Number(t.minAbsences), status: t.status, action: t.action,
  }));
  if (chronicAbsenceCount) rules.chronicAbsenceCount = Number(chronicAbsenceCount);
  if (goodAttendancePct) rules.goodAttendancePct = Number(goodAttendancePct);
  if (warnAttendancePct) rules.warnAttendancePct = Number(warnAttendancePct);
  await rules.save();
  await audit(req, 'ATTENDANCE_RULES_UPDATE', 'AttendanceRule', rules._id, { thresholds: rules.thresholds });
  res.json(rules);
}));

/* ---------- follow-up register ---------- */
router.get('/followups', authorize('dos', 'headteacher', 'trainer'), wrap(async (req, res) => {
  const q = {};
  if (req.query.student) q.student = req.query.student;
  res.json(await FollowUp.find(q).populate('student', 'firstName lastName admissionNo').populate('contactedBy', 'name').sort({ contactDate: -1 }).limit(200));
}));
router.post('/followups', authorize('dos', 'headteacher', 'trainer'), wrap(async (req, res) => {
  const f = await FollowUp.create({ ...req.body, contactedBy: req.user._id });
  await audit(req, 'FOLLOWUP_CREATE', 'FollowUp', f._id, { student: f.student });
  res.status(201).json(f);
}));
router.put('/followups/:id', authorize('dos', 'headteacher', 'trainer'), wrap(async (req, res) => {
  const f = await FollowUp.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await audit(req, 'FOLLOWUP_UPDATE', 'FollowUp', req.params.id);
  res.json(f);
}));

module.exports = router;
