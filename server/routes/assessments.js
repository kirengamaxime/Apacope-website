const router = require('express').Router();
const { Assessment, Student, Assignment } = require('../models');
const { protect, authorize, visibleStudentIds } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, gradeFor, paging } = require('../utils/helpers');

router.use(protect);

async function canMark(user, classId, moduleId) {
  if (['admin', 'dos', 'headteacher'].includes(user.role)) return true;
  return !!(await Assignment.exists({ trainer: user._id, class: classId, module: moduleId }));
}

/** Enter/update marks for a whole class in one go */
router.post('/bulk', authorize('trainer', 'dos'), wrap(async (req, res) => {
  const { classId, moduleId, termId, type, title, maxScore, marks } = req.body;
  if (!classId || !moduleId || !type || !maxScore || !Array.isArray(marks)) return res.status(400).json({ message: 'Missing fields' });
  if (!(await canMark(req.user, classId, moduleId))) return res.status(403).json({ message: 'Not assigned to this class/module' });
  for (const m of marks) {
    if (m.score < 0 || m.score > maxScore) return res.status(400).json({ message: `Score out of range for a student (0-${maxScore})` });
  }
  const ops = marks.map((m) => ({
    updateOne: {
      filter: { student: m.student, module: moduleId, term: termId || null, type, title: title || type },
      update: { $set: { class: classId, score: m.score, maxScore, competent: (m.score / maxScore) * 100 >= 70, enteredBy: req.user._id } },
      upsert: true,
    },
  }));
  await Assessment.bulkWrite(ops);
  await audit(req, 'MARKS_SAVE', 'Assessment', classId, { moduleId, type, title, count: marks.length });
  res.json({ saved: marks.length });
}));

router.put('/:id', authorize('trainer', 'dos'), wrap(async (req, res) => {
  const a = await Assessment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!(await canMark(req.user, a.class, a.module))) return res.status(403).json({ message: 'Not allowed' });
  const before = a.score;
  a.score = req.body.score;
  if (req.body.maxScore) a.maxScore = req.body.maxScore;
  a.competent = (a.score / a.maxScore) * 100 >= 70;
  a.enteredBy = req.user._id;
  await a.save();
  await audit(req, 'MARKS_CHANGE', 'Assessment', a._id, { student: a.student, from: before, to: a.score });
  res.json(a);
}));

/** Student results with totals, averages, grades and competency (privacy scoped) */
router.get('/results/:studentId', wrap(async (req, res) => {
  const ids = await visibleStudentIds(req.user);
  if (ids && !ids.some((i) => String(i) === req.params.studentId)) return res.status(403).json({ message: 'Not allowed' });
  const q = { student: req.params.studentId };
  if (req.query.term) q.term = req.query.term;
  const rows = await Assessment.find(q).populate('module', 'name code').sort({ createdAt: 1 });
  const byModule = {};
  rows.forEach((r) => {
    const id = String(r.module?._id);
    byModule[id] ||= { module: r.module?.name, code: r.module?.code, items: [], total: 0, max: 0 };
    byModule[id].items.push({ id: r._id, type: r.type, title: r.title, score: r.score, maxScore: r.maxScore });
    byModule[id].total += r.score;
    byModule[id].max += r.maxScore;
  });
  const modules = Object.values(byModule).map((m) => {
    const percentage = m.max ? Math.round((m.total / m.max) * 1000) / 10 : 0;
    return { ...m, percentage, ...gradeFor(percentage), competent: percentage >= 70 };
  });
  const average = modules.length ? Math.round((modules.reduce((s, m) => s + m.percentage, 0) / modules.length) * 10) / 10 : 0;
  res.json({ modules, average, ...gradeFor(average) });
}));

/** Class marksheet for one module */
router.get('/marksheet', authorize('trainer', 'dos', 'headteacher'), wrap(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId) return res.status(400).json({ message: 'classId and moduleId required' });
  const students = await Student.find({ class: classId, status: 'active' }).sort({ lastName: 1 }).select('firstName lastName admissionNo');
  const q = { class: classId, module: moduleId };
  if (termId) q.term = termId;
  const marks = await Assessment.find(q);
  res.json(students.map((s) => {
    const mine = marks.filter((m) => String(m.student) === String(s._id));
    const total = mine.reduce((t, m) => t + m.score, 0);
    const max = mine.reduce((t, m) => t + m.maxScore, 0);
    const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
    return { student: s._id, name: `${s.firstName} ${s.lastName}`, admissionNo: s.admissionNo, assessments: mine, total, max, percentage, ...gradeFor(percentage) };
  }));
}));

module.exports = router;
