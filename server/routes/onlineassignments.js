const router = require('express').Router();
const { Assignment, Student } = require('../models');
const { OnlineAssignment, OnlineSubmission } = require('../models/OnlineAssignment');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, endOfDay } = require('../utils/helpers');

router.use(protect);

const MANAGERS = ['admin', 'dos', 'headteacher'];
const same = (a, b) => String(a) === String(b);
const round = (n) => Math.round(n * 100) / 100;
const POPULATE = [
  { path: 'class', select: 'name level' },
  { path: 'module', select: 'name code' },
  { path: 'term', select: 'name' },
  { path: 'trainer', select: 'name' },
  { path: 'reviewedBy', select: 'name' },
];
/** The app's input filter turns "<" into "&lt;". Learners write code (<div>...), so put it back. React still escapes it when shown. */
const raw = (s) => String(s ?? '').replace(/&lt;/g, '<');
const totalPoints = (a) => round(a.questions.reduce((t, q) => t + q.points, 0));

async function canTeach(user, classId, moduleId) {
  if (user.role === 'admin') return true;
  return !!(await Assignment.exists({ trainer: user._id, class: classId, module: moduleId }));
}

/** The Student record behind a learner login */
const studentOf = (user) => Student.findOne({ user: user._id }).select('_id class firstName lastName');

/** Staff who may look at this assignment's answers and marks */
const staffMay = (user, a) => MANAGERS.includes(user.role) || (user.role === 'trainer' && same(a.trainer?._id || a.trainer, user._id));

/** Validate the questions a trainer typed in */
function cleanQuestions(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('Add at least one question.');
  return list.map((q, i) => {
    const text = raw(q.text).trim();
    if (!text) throw new Error(`Question ${i + 1} is empty.`);
    const points = Number(q.points);
    if (!(points > 0)) throw new Error(`Question ${i + 1} needs points greater than 0.`);
    const out = { text, type: q.type === 'choice' ? 'choice' : 'text', points };
    if (q._id) out._id = q._id;
    if (out.type === 'choice') {
      out.options = (q.options || []).map((o) => raw(o).trim()).filter(Boolean);
      if (out.options.length < 2) throw new Error(`Question ${i + 1} needs at least two choices.`);
      out.correct = Number(q.correct);
      if (!Number.isInteger(out.correct) || out.correct < 0 || out.correct >= out.options.length) throw new Error(`Question ${i + 1}: pick the correct choice.`);
    }
    return out;
  });
}

/** Learners never receive the answer key until their marks are approved */
function forLearner(a, showKey) {
  const o = a.toObject();
  o.questions = o.questions.map((q) => { if (!showKey) delete q.correct; return q; });
  delete o.students;
  return o;
}

/* ------------------------------------------------------------------ list */
router.get('/', wrap(async (req, res) => {
  const role = req.user.role;
  let q = {};
  let me = null;
  if (role === 'student') {
    me = await studentOf(req.user);
    if (!me) return res.json({ items: [], pending: 0 });
    q = { students: me._id, status: 'published' };
  } else if (role === 'trainer') q = { trainer: req.user._id };
  else if (!MANAGERS.includes(role)) return res.status(403).json({ message: 'You do not have permission to do this' });
  if (req.query.marksStatus) q.marksStatus = req.query.marksStatus;

  const list = await OnlineAssignment.find(q).populate(POPULATE).sort({ createdAt: -1 }).limit(200);
  const subs = await OnlineSubmission.find({ assignment: { $in: list.map((a) => a._id) }, ...(me ? { student: me._id } : {}) })
    .select('assignment status marked total');
  const items = list.map((a) => {
    const mine = subs.filter((s) => same(s.assignment, a._id));
    const base = {
      _id: a._id, title: a.title, class: a.class, module: a.module, term: a.term, trainer: a.trainer, dueDate: a.dueDate,
      status: a.status, marksStatus: a.marksStatus, createdAt: a.createdAt, points: totalPoints(a), questionCount: a.questions.length,
      reviewComment: a.reviewComment,
    };
    if (me) {
      const s = mine[0];
      const seen = a.marksStatus === 'approved' && s?.marked;
      return { ...base, mine: { status: s?.status || 'new', marked: !!s?.marked, total: seen ? s.total : null } };
    }
    return { ...base, recipients: a.students.length, submitted: mine.filter((s) => s.status === 'submitted').length, marked: mine.filter((s) => s.marked).length };
  });
  const pending = role === 'trainer' || MANAGERS.includes(role) ? items.filter((i) => i.marksStatus === 'pending').length : 0;
  res.json({ items, pending });
}));

/* ---------------------------------------------------------------- create */
router.post('/', authorize('trainer'), wrap(async (req, res) => {
  const b = req.body;
  if (!raw(b.title).trim()) return res.status(400).json({ message: 'Give the assignment a title.' });
  if (!b.classId || !b.moduleId) return res.status(400).json({ message: 'Choose the class and the module.' });
  if (!(await canTeach(req.user, b.classId, b.moduleId))) return res.status(403).json({ message: 'You are not assigned to this class and module.' });
  let questions;
  try { questions = cleanQuestions(b.questions); } catch (e) { return res.status(400).json({ message: e.message }); }
  const ids = [...new Set((b.studentIds || []).map(String))];
  if (!ids.length) return res.status(400).json({ message: 'Choose at least one learner.' });
  const found = await Student.countDocuments({ _id: { $in: ids }, class: b.classId, status: 'active' });
  if (found !== ids.length) return res.status(400).json({ message: 'Some chosen learners are not active learners of this class.' });
  const a = await OnlineAssignment.create({
    title: raw(b.title).trim(), instructions: raw(b.instructions).trim(), class: b.classId, module: b.moduleId, term: b.termId || undefined,
    trainer: req.user._id, students: ids, dueDate: b.dueDate || undefined, questions, status: b.status === 'draft' ? 'draft' : 'published',
  });
  await audit(req, 'ASSIGNMENT_CREATE', 'OnlineAssignment', a._id, { title: a.title, learners: ids.length });
  res.status(201).json(a);
}));

/* ---------------------------------------------------------------- one */
router.get('/:id', wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id).populate(POPULATE).populate('students', 'firstName lastName admissionNo');
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'student') {
    const me = await studentOf(req.user);
    if (!me || !a.students.some((s) => same(s._id, me._id)) || a.status !== 'published') return res.status(403).json({ message: 'This assignment is not for you.' });
    const sub = await OnlineSubmission.findOne({ assignment: a._id, student: me._id });
    const approved = a.marksStatus === 'approved' && sub?.marked;
    return res.json({
      role: 'student',
      assignment: forLearner(a, approved),
      points: totalPoints(a),
      mine: sub ? {
        status: sub.status, answers: sub.answers, submittedAt: sub.submittedAt, marksReleased: !!approved,
        ...(approved ? { scores: sub.scores, total: sub.total, feedback: sub.feedback } : {}),
      } : { status: 'new', answers: [], marksReleased: false },
    });
  }
  if (!staffMay(req.user, a)) return res.status(403).json({ message: 'You do not have permission to do this' });
  res.json({ role: 'staff', assignment: a, points: totalPoints(a) });
}));

router.put('/:id', authorize('trainer'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!same(a.trainer, req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'This is not your assignment.' });
  if (['pending', 'approved'].includes(a.marksStatus)) return res.status(423).json({ message: 'The marks were sent to the DOS, so this assignment is locked. Ask the DOS to return them first.' });
  const b = req.body;
  const hasWork = await OnlineSubmission.exists({ assignment: a._id });
  if (b.title !== undefined) { if (!raw(b.title).trim()) return res.status(400).json({ message: 'Give the assignment a title.' }); a.title = raw(b.title).trim(); }
  if (b.instructions !== undefined) a.instructions = raw(b.instructions).trim();
  if (b.dueDate !== undefined) a.dueDate = b.dueDate || undefined;
  if (b.status) a.status = b.status === 'draft' ? 'draft' : 'published';
  if (b.questions) {
    if (hasWork) return res.status(400).json({ message: 'Learners have already started this assignment, so the questions can no longer be changed. You can still change the title, instructions, due date and learners.' });
    try { a.questions = cleanQuestions(b.questions); } catch (e) { return res.status(400).json({ message: e.message }); }
  }
  if (b.studentIds) {
    const ids = [...new Set(b.studentIds.map(String))];
    if (!ids.length) return res.status(400).json({ message: 'Choose at least one learner.' });
    const worked = (await OnlineSubmission.find({ assignment: a._id }).select('student')).map((s) => String(s.student));
    if (worked.some((w) => !ids.includes(w))) return res.status(400).json({ message: 'A learner who already started the assignment cannot be removed.' });
    const found = await Student.countDocuments({ _id: { $in: ids }, class: a.class, status: 'active' });
    if (found !== ids.length) return res.status(400).json({ message: 'Some chosen learners are not active learners of this class.' });
    a.students = ids;
  }
  await a.save();
  await audit(req, 'ASSIGNMENT_EDIT', 'OnlineAssignment', a._id);
  res.json(a);
}));

router.delete('/:id', authorize('trainer'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!same(a.trainer, req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'This is not your assignment.' });
  if (['pending', 'approved'].includes(a.marksStatus)) return res.status(400).json({ message: 'Marks that were sent to the DOS cannot be deleted. Ask the DOS to return them first.' });
  await OnlineSubmission.deleteMany({ assignment: a._id });
  await a.deleteOne();
  await audit(req, 'ASSIGNMENT_DELETE', 'OnlineAssignment', a._id, { title: a.title });
  res.json({ message: 'Deleted' });
}));

/* ------------------------------------------------- learner: answer + send */
async function learnerContext(req, res) {
  if (req.user.role !== 'student') { res.status(403).json({ message: 'Only learners can answer an assignment.' }); return null; }
  const me = await studentOf(req.user);
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a || !me || a.status !== 'published' || !a.students.some((s) => same(s, me._id))) { res.status(403).json({ message: 'This assignment is not for you.' }); return null; }
  if (a.marksStatus !== 'open') { res.status(400).json({ message: 'This assignment is closed.' }); return null; }
  if (a.dueDate && Date.now() > endOfDay(a.dueDate).getTime()) { res.status(400).json({ message: 'The deadline has passed. Ask your trainer if you still need to send it.' }); return null; }
  const sub = (await OnlineSubmission.findOne({ assignment: a._id, student: me._id })) || new OnlineSubmission({ assignment: a._id, student: me._id });
  if (sub.status === 'submitted') { res.status(400).json({ message: 'You already sent this assignment.' }); return null; }
  return { a, me, sub };
}

function applyAnswers(a, sub, list) {
  const valid = new Set(a.questions.map((q) => String(q._id)));
  sub.answers = (Array.isArray(list) ? list : [])
    .filter((x) => valid.has(String(x.question)))
    .map((x) => ({ question: x.question, answer: raw(x.answer).slice(0, 8000) }));
}

/** Save work in progress without sending it */
router.put('/:id/answers', wrap(async (req, res) => {
  const ctx = await learnerContext(req, res);
  if (!ctx) return;
  applyAnswers(ctx.a, ctx.sub, req.body.answers);
  await ctx.sub.save();
  res.json({ saved: true, savedAt: new Date() });
}));

/** Send the finished work to the trainer. Multiple-choice questions are marked straight away. */
router.post('/:id/submit', wrap(async (req, res) => {
  const ctx = await learnerContext(req, res);
  if (!ctx) return;
  const { a, sub } = ctx;
  if (req.body.answers) applyAnswers(a, sub, req.body.answers);
  const given = new Map(sub.answers.map((x) => [String(x.question), x.answer]));
  sub.scores = a.questions.map((q) => {
    const pick = given.get(String(q._id));
    const auto = q.type === 'choice' && pick !== undefined && String(pick).trim() !== '' && Number(pick) === q.correct; // an empty answer is never right
    return { question: q._id, score: auto ? q.points : 0, comment: '' };
  });
  sub.total = round(sub.scores.reduce((t, s) => t + s.score, 0));
  sub.status = 'submitted';
  sub.submittedAt = new Date();
  sub.marked = false;
  await sub.save();
  await audit(req, 'ASSIGNMENT_SUBMIT', 'OnlineAssignment', a._id);
  res.json({ status: 'submitted', submittedAt: sub.submittedAt });
}));

/* ------------------------------------------------------ staff: the answers */
router.get('/:id/submissions', wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id).populate('students', 'firstName lastName admissionNo');
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!staffMay(req.user, a)) return res.status(403).json({ message: 'You do not have permission to do this' });
  const subs = await OnlineSubmission.find({ assignment: a._id });
  const rows = a.students
    .map((s) => ({ student: s, sub: subs.find((x) => same(x.student, s._id)) || null }))
    .sort((x, y) => `${x.student.lastName}${x.student.firstName}`.localeCompare(`${y.student.lastName}${y.student.firstName}`));
  res.json({ rows, points: totalPoints(a) });
}));

/** Trainer marks one learner's work: a score and comment per question, plus overall feedback */
router.put('/:id/submissions/:studentId/mark', authorize('trainer'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!same(a.trainer, req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'This is not your assignment.' });
  if (['pending', 'approved'].includes(a.marksStatus)) return res.status(423).json({ message: 'The marks were sent to the DOS and are locked. Ask the DOS to return them if you need to change something.' });
  const sub = await OnlineSubmission.findOne({ assignment: a._id, student: req.params.studentId });
  if (!sub || sub.status !== 'submitted') return res.status(400).json({ message: 'This learner has not sent the assignment yet.' });
  const incoming = new Map((req.body.scores || []).map((s) => [String(s.question), s]));
  const out = [];
  for (const q of a.questions) {
    const s = incoming.get(String(q._id));
    const score = Number(s?.score ?? 0);
    if (Number.isNaN(score) || score < 0 || score > q.points) return res.status(400).json({ message: `A score must be between 0 and ${q.points} for that question.` });
    out.push({ question: q._id, score, comment: raw(s?.comment).slice(0, 500) });
  }
  sub.scores = out;
  sub.total = round(out.reduce((t, s) => t + s.score, 0));
  sub.feedback = raw(req.body.feedback).slice(0, 1000);
  sub.marked = true;
  sub.markedAt = new Date();
  await sub.save();
  await audit(req, 'ASSIGNMENT_MARK', 'OnlineAssignment', a._id, { student: req.params.studentId, total: sub.total });
  res.json({ total: sub.total, marked: true });
}));

/* ------------------------------------------------------- send to the DOS */
router.post('/:id/send', authorize('trainer'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!same(a.trainer, req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'This is not your assignment.' });
  if (!['open', 'returned'].includes(a.marksStatus)) return res.status(400).json({ message: a.marksStatus === 'approved' ? 'These marks are already approved.' : 'These marks are already with the DOS.' });
  const subs = await OnlineSubmission.find({ assignment: a._id, status: 'submitted' });
  if (!subs.length) return res.status(400).json({ message: 'No learner has sent this assignment yet, so there is nothing to mark.' });
  const waiting = subs.filter((s) => !s.marked).length;
  if (waiting) return res.status(400).json({ message: `${waiting} sent assignment${waiting === 1 ? ' is' : 's are'} not marked yet. Mark every one before sending to the DOS.` });
  a.marksStatus = 'pending';
  a.sentAt = new Date();
  a.reviewComment = '';
  await a.save();
  await audit(req, 'ASSIGNMENT_SEND', 'OnlineAssignment', a._id, { marked: subs.length });
  res.json({ marksStatus: a.marksStatus });
}));

/* ------------------------------------------------------------ the DOS decides */
router.post('/:id/approve', authorize('dos'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (a.marksStatus !== 'pending') return res.status(400).json({ message: 'Only marks that were sent to the DOS can be approved.' });
  a.marksStatus = 'approved';
  a.reviewedBy = req.user._id;
  a.reviewedAt = new Date();
  a.reviewComment = String(req.body.comment || '').trim().slice(0, 500);
  await a.save();
  await audit(req, 'ASSIGNMENT_APPROVE', 'OnlineAssignment', a._id);
  res.json({ marksStatus: a.marksStatus });
}));

router.post('/:id/return', authorize('dos'), wrap(async (req, res) => {
  const a = await OnlineAssignment.findById(req.params.id);
  if (!a) return res.status(404).json({ message: 'Not found' });
  if (!['pending', 'approved'].includes(a.marksStatus)) return res.status(400).json({ message: 'Only marks that were sent or approved can be returned.' });
  const comment = String(req.body.comment || '').trim().slice(0, 500);
  if (!comment) return res.status(400).json({ message: 'Write a short reason so the trainer knows what to correct.' });
  a.marksStatus = 'returned';
  a.reviewedBy = req.user._id;
  a.reviewedAt = new Date();
  a.reviewComment = comment;
  await a.save();
  await audit(req, 'ASSIGNMENT_RETURN', 'OnlineAssignment', a._id, { comment });
  res.json({ marksStatus: a.marksStatus });
}));

module.exports = router;