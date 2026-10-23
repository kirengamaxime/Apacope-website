const router = require('express').Router();
const { Assessment, Student, Assignment } = require('../models');
const MarkSubmission = require('../models/MarkSubmission');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, gradeFor } = require('../utils/helpers');

router.use(protect, authorize('trainer', 'dos', 'headteacher'));

async function canMark(user, classId, moduleId) {
  if (['admin', 'dos', 'headteacher'].includes(user.role)) return true;
  return !!(await Assignment.exists({ trainer: user._id, class: classId, module: moduleId }));
}

const POPULATE = [
  { path: 'class', select: 'name level' },
  { path: 'module', select: 'name code' },
  { path: 'term', select: 'name' },
  { path: 'trainer', select: 'name' },
  { path: 'reviewedBy', select: 'name' },
];

/** Where do these marks stand? (used by the marks entry page) */
router.get('/status', wrap(async (req, res) => {
  const { classId, moduleId, termId } = req.query;
  if (!classId || !moduleId) return res.status(400).json({ message: 'classId and moduleId required' });
  if (!(await canMark(req.user, classId, moduleId))) return res.status(403).json({ message: 'Not assigned to this class/module' });
  const sub = await MarkSubmission.findOne({ class: classId, module: moduleId, term: termId || null }).populate('reviewedBy', 'name');
  res.json({
    status: sub?.status || 'draft',
    reviewComment: sub?.reviewComment || '',
    submittedAt: sub?.submittedAt,
    reviewedAt: sub?.reviewedAt,
    reviewedBy: sub?.reviewedBy?.name,
  });
}));

/** Trainer sends the marks of one class + module + term to the DOS */
router.post('/submit', authorize('trainer', 'dos'), wrap(async (req, res) => {
  const { classId, moduleId, termId } = req.body;
  if (!classId || !moduleId) return res.status(400).json({ message: 'classId and moduleId required' });
  if (!(await canMark(req.user, classId, moduleId))) return res.status(403).json({ message: 'Not assigned to this class/module' });
  const term = termId || null;
  const count = await Assessment.countDocuments({ class: classId, module: moduleId, term });
  if (!count) return res.status(400).json({ message: 'There are no marks to submit yet. Enter and save the marks first.' });
  let sub = await MarkSubmission.findOne({ class: classId, module: moduleId, term });
  if (sub && ['submitted', 'approved'].includes(sub.status)) {
    return res.status(400).json({ message: sub.status === 'approved' ? 'These marks are already approved.' : 'These marks are already submitted and waiting for the DOS.' });
  }
  if (!sub) sub = new MarkSubmission({ class: classId, module: moduleId, term });
  sub.status = 'submitted';
  sub.trainer = req.user._id;
  sub.submittedAt = new Date();
  sub.reviewComment = '';
  await sub.save();
  await audit(req, 'MARKS_SUBMIT', 'MarkSubmission', sub._id, { classId, moduleId, termId, count });
  res.json({ status: sub.status, submittedAt: sub.submittedAt });
}));

/** List: DOS and head teacher see everything, a trainer sees only their own submissions */
router.get('/', wrap(async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  else q.status = { $ne: 'draft' };
  if (req.user.role === 'trainer') q.trainer = req.user._id;
  const subs = await MarkSubmission.find(q).populate(POPULATE).sort({ submittedAt: -1, updatedAt: -1 }).limit(200);
  const items = await Promise.all(subs.map(async (s) => ({
    ...s.toObject(),
    marks: await Assessment.countDocuments({ class: s.class?._id, module: s.module?._id, term: s.term?._id || null }),
  })));
  const pending = await MarkSubmission.countDocuments({ status: 'submitted', ...(req.user.role === 'trainer' ? { trainer: req.user._id } : {}) });
  res.json({ items, pending });
}));

/** The actual marks behind a submission, one row per learner */
router.get('/:id/sheet', wrap(async (req, res) => {
  const sub = await MarkSubmission.findById(req.params.id).populate(POPULATE);
  if (!sub) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'trainer' && String(sub.trainer?._id) !== String(req.user._id)) return res.status(403).json({ message: 'Not allowed' });
  const filter = { class: sub.class._id, module: sub.module._id, term: sub.term?._id || null };
  const [students, marks] = await Promise.all([
    Student.find({ class: sub.class._id, status: 'active' }).sort({ lastName: 1 }).select('firstName lastName admissionNo'),
    Assessment.find(filter).sort({ createdAt: 1 }),
  ]);
  const columns = [];
  const index = new Map();
  marks.forEach((m) => {
    const key = `${m.type}|${m.title}|${m.maxScore}`;
    if (!index.has(key)) { index.set(key, columns.length); columns.push({ type: m.type, title: m.title, maxScore: m.maxScore }); }
  });
  const rows = students.map((s) => {
    const mine = marks.filter((m) => String(m.student) === String(s._id));
    const scores = columns.map(() => null);
    mine.forEach((m) => { scores[index.get(`${m.type}|${m.title}|${m.maxScore}`)] = m.score; });
    const total = mine.reduce((t, m) => t + m.score, 0);
    const max = mine.reduce((t, m) => t + m.maxScore, 0);
    const percentage = max ? Math.round((total / max) * 1000) / 10 : 0;
    return { student: s._id, name: `${s.lastName} ${s.firstName}`, admissionNo: s.admissionNo, scores, total, max, percentage, ...gradeFor(percentage) };
  });
  res.json({ submission: sub, columns, rows });
}));

const reviewable = async (req, res) => {
  const sub = await MarkSubmission.findById(req.params.id);
  if (!sub) { res.status(404).json({ message: 'Not found' }); return null; }
  return sub;
};

/** DOS approves submitted marks. From now on learners and parents can see them. */
router.post('/:id/approve', authorize('dos'), wrap(async (req, res) => {
  const sub = await reviewable(req, res);
  if (!sub) return;
  if (sub.status !== 'submitted') return res.status(400).json({ message: 'Only submitted marks can be approved.' });
  sub.status = 'approved';
  sub.reviewedBy = req.user._id;
  sub.reviewedAt = new Date();
  sub.reviewComment = String(req.body.comment || '').trim().slice(0, 500);
  await sub.save();
  await audit(req, 'MARKS_APPROVE', 'MarkSubmission', sub._id);
  res.json({ status: sub.status });
}));

/** DOS sends marks back to the trainer with a reason. Also works to reopen marks that were already approved. */
router.post('/:id/return', authorize('dos'), wrap(async (req, res) => {
  const sub = await reviewable(req, res);
  if (!sub) return;
  if (!['submitted', 'approved'].includes(sub.status)) return res.status(400).json({ message: 'Only submitted or approved marks can be returned.' });
  const comment = String(req.body.comment || '').trim().slice(0, 500);
  if (!comment) return res.status(400).json({ message: 'Write a short reason so the trainer knows what to correct.' });
  sub.status = 'returned';
  sub.reviewedBy = req.user._id;
  sub.reviewedAt = new Date();
  sub.reviewComment = comment;
  await sub.save();
  await audit(req, 'MARKS_RETURN', 'MarkSubmission', sub._id, { comment });
  res.json({ status: sub.status });
}));

module.exports = router;