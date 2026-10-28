/*
 * Student report cards: built from the recorded marks, with a comment written by the DOS.
 * Every module lists its assessments in three categories (formative, summative, comprehensive); marks that came from an
 * online assignment are tagged. Only marks the DOS approved are used.
 *   GET  /api/report-cards/class/:classId?termId=   list of a class with averages and positions        (DOS, head teacher)
 *   GET  /api/report-cards/:studentId?termId=        one full report (+ suggested comment)               (DOS, head teacher)
 *   PUT  /api/report-cards/:studentId/comment        save the DOS comment                                (DOS, head teacher)
 *   GET  /api/report-cards/mine/students             the learners a learner / parent may open
 *  *   GET  /api/report-cards/progress/:studentId       averages term by term, per module and type          (staff, learner, parent)
 *   GET  /api/report-cards/mine/:studentId?termId=   a learner's own report (and /pdf)                   (learner, parent)
 */
const router = require('express').Router();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { Student, Assessment, Term, Attendance } = require('../models');
const { drawCard } = require('../utils/reportCardPdf');
const { protect, authorize, visibleStudentIds } = require('../middleware/auth');
const { approvedOnly } = require('../utils/approvedMarks');
const { audit } = require('../middleware/audit');
const { wrap, gradeFor, pct } = require('../utils/helpers');

const { Schema } = mongoose;
const reportCommentSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  term: { type: Schema.Types.ObjectId, ref: 'Term', default: null },
  comment: { type: String, default: '', maxlength: 1000 },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
reportCommentSchema.index({ student: 1, term: 1 }, { unique: true });
const ReportComment = mongoose.models.ReportComment || mongoose.model('ReportComment', reportCommentSchema);

router.use(protect);
const staff = authorize('dos', 'headteacher');

const round1 = (n) => Math.round(n * 10) / 10;

const TYPES = [['formative', 'Formative assessments'], ['summative', 'Summative assessments'], ['comprehensive', 'Comprehensive assessments']];

/** Group a student's assessment rows into modules, each split into categories, with totals, percentage, grade and competency */
function buildModules(rows, online = new Set()) {
  const by = {};
  rows.forEach((r) => {
    const id = String(r.module?._id || r.module);
    by[id] ||= { module: r.module?.name || 'Module', code: r.module?.code || '', items: [], total: 0, max: 0 };
    by[id].items.push({
      type: r.type, title: r.title, score: r.score, maxScore: r.maxScore,
      percentage: r.maxScore ? round1((r.score / r.maxScore) * 100) : 0, online: online.has(String(r._id)),
    });
    by[id].total += r.score;
    by[id].max += r.maxScore;
  });
  return Object.values(by).map((m) => {
    const percentage = m.max ? round1((m.total / m.max) * 100) : 0;
    const categories = TYPES.map(([type, label]) => {
      const items = m.items.filter((i) => i.type === type);
      const total = items.reduce((t, i) => t + i.score, 0);
      const max = items.reduce((t, i) => t + i.maxScore, 0);
      return { type, label, items, total, max, percentage: max ? round1((total / max) * 100) : 0 };
    }).filter((c) => c.items.length);
    return { ...m, categories, percentage, ...gradeFor(percentage), competent: percentage >= 70 };
  }).sort((a, b) => a.module.localeCompare(b.module));
}

/** Marks added up per assessment type over all modules (the "assessment summary" of the report) */
function typeTotals(modules) {
  return TYPES.map(([type, label]) => {
    const cats = modules.flatMap((m) => m.categories.filter((c) => c.type === type));
    const total = cats.reduce((t, c) => t + c.total, 0);
    const max = cats.reduce((t, c) => t + c.max, 0);
    return { type, label: label.replace(' assessments', ''), count: cats.reduce((t, c) => t + c.items.length, 0), total, max, percentage: max ? round1((total / max) * 100) : 0 };
  });
}

const averageOf = (modules) => (modules.length ? round1(modules.reduce((s, m) => s + m.percentage, 0) / modules.length) : 0);

/** Per-student average for a whole class, plus rank (1 = best; equal averages share a rank) */
function rankClass(students, assessments) {
  const rows = students.map((s) => {
    const mods = buildModules(assessments.filter((a) => String(a.student) === String(s._id)));
    return { student: s, modules: mods, average: averageOf(mods) };
  });
  const withMarks = rows.filter((r) => r.modules.length);
  rows.forEach((r) => { r.position = r.modules.length ? 1 + withMarks.filter((o) => o.average > r.average).length : null; });
  return { rows, ranked: withMarks.length };
}

/** A first draft of the DOS comment, written from the marks. The DOS can edit it. */
function suggestComment(firstName, modules, average) {
  if (!modules.length) return '';
  const best = [...modules].sort((a, b) => b.percentage - a.percentage)[0];
  const weak = modules.filter((m) => !m.competent).sort((a, b) => a.percentage - b.percentage);
  let text;
  if (average >= 80) text = `${firstName} has achieved excellent results this term, with an average of ${average}%. Keep up this outstanding work and continue to be a good example to others.`;
  else if (average >= 70) text = `${firstName} has done very well this term, with an average of ${average}%, and is competent in ${modules.length - weak.length} of ${modules.length} modules. With a little more effort the top grade is within reach.`;
  else if (average >= 60) text = `${firstName} has performed well this term with an average of ${average}%. More regular revision and practice will lift the results further.`;
  else if (average >= 50) text = `${firstName} has reached an average of ${average}%, which is a fair result but below the competency level of 70%. More effort in class and at home is needed to improve.`;
  else text = `${firstName}'s average of ${average}% is below the expected level this term. Urgent extra support, regular attendance and a firm study plan are needed, and the school will follow up with the parent or guardian.`;
  if (average >= 50 && best && modules.length > 1) text += ` Strongest module: ${best.module} (${best.percentage}%).`;
  if (weak.length) text += ` Needs to improve in: ${weak.slice(0, 3).map((m) => `${m.module} (${m.percentage}%)`).join(', ')}.`;
  return text;
}

const termFilter = (termId) => (termId ? { term: termId } : {});

// List a class for the DOS: averages, grades, positions and who already has a comment
router.get('/class/:classId', staff, wrap(async (req, res) => {
  const { termId } = req.query;
  const students = await Student.find({ class: req.params.classId, status: 'active' }).sort({ lastName: 1 }).select('firstName lastName admissionNo');
  const { rows: marks } = await approvedOnly(await Assessment.find({ class: req.params.classId, ...termFilter(termId) }).populate('module', 'name code'));
  const comments = await ReportComment.find({ student: { $in: students.map((s) => s._id) }, term: termId || null }).select('student');
  const done = new Set(comments.map((c) => String(c.student)));
  const { rows, ranked } = rankClass(students, marks);
  res.json({
    ranked,
    students: rows.map((r) => ({
      id: r.student._id, name: `${r.student.firstName} ${r.student.lastName}`, admissionNo: r.student.admissionNo,
      modules: r.modules.length, average: r.average, ...(r.modules.length ? gradeFor(r.average) : { grade: '', remark: '' }),
      position: r.position, hasComment: done.has(String(r.student._id)),
    })),
  });
}));

/** Everything one report card needs, as one object (used by the screen and the PDF) */
async function buildReport(studentId, termId) {
  const student = await Student.findById(studentId).populate({ path: 'class', populate: { path: 'trade', select: 'name code' } });
  if (!student) return null;
  const term = termId ? await Term.findById(termId).populate('academicYear', 'name') : null;

  const { rows: marks, online } = await approvedOnly(await Assessment.find({ student: student._id, ...termFilter(termId) }).populate('module', 'name code').sort({ createdAt: 1 }));
  const modules = buildModules(marks, online);
  const average = averageOf(modules);

  const classmates = await Student.find({ class: student.class?._id, status: 'active' }).select('_id');
  const { rows: classMarks } = await approvedOnly(await Assessment.find({ class: student.class?._id, ...termFilter(termId) }).populate('module', 'name code'));
  const { rows, ranked } = rankClass(classmates, classMarks);
  const position = rows.find((r) => String(r.student._id) === String(student._id))?.position || null;

  let attendance = null;
  if (term?.startDate && term?.endDate) {
    const recs = await Attendance.find({ student: student._id, date: { $gte: term.startDate, $lte: term.endDate } }).select('status');
    const absent = recs.filter((r) => r.status === 'absent').length;
    attendance = { sessions: recs.length, absent, percentage: pct(recs.length - absent, recs.length) };
  }

  const saved = await ReportComment.findOne({ student: student._id, term: termId || null });
  return {
    student: { id: student._id, firstName: student.firstName, lastName: student.lastName, admissionNo: student.admissionNo, gender: student.gender },
    class: student.class ? { name: student.class.name, level: student.class.level, trade: student.class.trade?.name } : null,
    term: term ? { name: term.name, year: term.academicYear?.name } : null,
    modules, typeTotals: typeTotals(modules), average, ...(modules.length ? gradeFor(average) : { grade: '', remark: '' }),
    competentCount: modules.filter((m) => m.competent).length,
    position, outOf: ranked, attendance,
    comment: saved?.comment || '',
    suggestedComment: suggestComment(student.firstName, modules, average),
  };
}

const safeName = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

// Whole class in one PDF, one page per learner (saved comment, or the suggested one if none is saved)
router.get('/class/:classId/pdf', staff, wrap(async (req, res) => {
  const { termId } = req.query;
  const students = await Student.find({ class: req.params.classId, status: 'active' }).sort({ lastName: 1 }).select('_id lastName');
  if (!students.length) return res.status(404).json({ message: 'No active learners in this class' });
  const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: false });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="class-report-cards.pdf"');
  doc.pipe(res);
  for (const s of students) {
    const report = await buildReport(s._id, termId);
    doc.addPage();
    drawCard(doc, report);
  }
  await audit(req, 'REPORT_CARD_EXPORT', 'Class', req.params.classId, { termId, count: students.length });
  doc.end();
}));
/* ------------------------------------------------ progress over the terms */
/** Averages term by term (approved marks only), per module and per assessment type, so improvement or decline is visible */
router.get('/progress/:studentId', wrap(async (req, res) => {
  const ids = await visibleStudentIds(req.user); // null = staff
  if (ids && !ids.map(String).includes(String(req.params.studentId))) return res.status(403).json({ message: 'Not allowed' });
  if (!ids && !['admin', 'dos', 'headteacher', 'trainer'].includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to do this' });
  const student = await Student.findById(req.params.studentId).select('firstName lastName admissionNo');
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const { rows: marks, online } = await approvedOnly(await Assessment.find({ student: student._id }).populate('module', 'name code').sort({ createdAt: 1 }));
  const termIds = [...new Set(marks.map((m) => String(m.term || '')).filter(Boolean))];
  const terms = await Term.find({ _id: { $in: termIds } }).populate('academicYear', 'name');
  const when = (t) => new Date(t.startDate || t.createdAt || 0).getTime();
  const ordered = [...terms].sort((a, b) => when(a) - when(b));

  const points = ordered.map((t) => {
    const modules = buildModules(marks.filter((m) => String(m.term) === String(t._id)), online);
    const avg = averageOf(modules);
    const byType = Object.fromEntries(typeTotals(modules).map((x) => [x.type, x.max ? x.percentage : null]));
    return {
      termId: t._id, name: t.name, year: t.academicYear?.name || '', label: `${t.name}${t.academicYear?.name ? ` ${t.academicYear.name}` : ''}`,
      average: avg, ...(modules.length ? gradeFor(avg) : { grade: '', remark: '' }), types: byType,
      modules: modules.map((m) => ({ module: m.module, code: m.code, percentage: m.percentage, grade: m.grade, competent: m.competent })),
    };
  }).filter((p) => p.modules.length);

  const last = points[points.length - 1];
  const before = points[points.length - 2];
  const change = last && before ? round1(last.average - before.average) : null;
  const trend = change === null ? null : change > 1 ? 'up' : change < -1 ? 'down' : 'steady';
  const moduleNames = [...new Set(points.flatMap((p) => p.modules.map((m) => m.module)))].sort();
  res.json({
    student: { id: student._id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo },
    points, modules: moduleNames, change, trend,
  });
}));

/* ------------------------------------------------ learners and parents: their own report */
/** The learners this login may open: a learner sees themselves, a parent sees their children */
async function mineIds(req, res) {
  const ids = await visibleStudentIds(req.user);
  if (ids === null) { res.status(403).json({ message: 'You do not have permission to do this' }); return null; }
  return ids.map(String);
}

router.get('/mine/students', wrap(async (req, res) => {
  const ids = await mineIds(req, res);
  if (!ids) return;
  const list = await Student.find({ _id: { $in: ids } }).populate('class', 'name').select('firstName lastName admissionNo class');
  res.json(list.map((s) => ({ id: s._id, name: `${s.firstName} ${s.lastName}`, admissionNo: s.admissionNo, class: s.class?.name || '' })));
}));

/** A learner's own copy never carries the automatic draft comment, only the one the DOS saved */
async function ownReport(req, res) {
  const ids = await mineIds(req, res);
  if (!ids) return null;
  if (!ids.includes(String(req.params.studentId))) { res.status(403).json({ message: 'Not allowed' }); return null; }
  const report = await buildReport(req.params.studentId, req.query.termId);
  if (!report) { res.status(404).json({ message: 'Student not found' }); return null; }
  report.suggestedComment = '';
  return report;
}

router.get('/mine/:studentId/pdf', wrap(async (req, res) => {
  const report = await ownReport(req, res);
  if (report) await sendPdf(req, res, report);
}));

router.get('/mine/:studentId', wrap(async (req, res) => {
  const report = await ownReport(req, res);
  if (report) res.json(report);
}));

/* ------------------------------------------------------------------ DOS and head teacher */
async function sendPdf(req, res, report) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-card-${safeName(report.student.lastName)}-${safeName(report.student.firstName)}.pdf"`);
  doc.pipe(res);
  drawCard(doc, report);
  await audit(req, 'REPORT_CARD_EXPORT', 'Student', report.student.id, { termId: req.query.termId });
  doc.end();
}

router.get('/:studentId/pdf', staff, wrap(async (req, res) => {
  const report = await buildReport(req.params.studentId, req.query.termId);
  if (!report) return res.status(404).json({ message: 'Student not found' });
  await sendPdf(req, res, report);
}));

// One complete report
router.get('/:studentId', staff, wrap(async (req, res) => {
  const report = await buildReport(req.params.studentId, req.query.termId);
  if (!report) return res.status(404).json({ message: 'Student not found' });
  res.json(report);
}));

router.put('/:studentId/comment', staff, wrap(async (req, res) => {
  const { termId } = req.body;
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  if (!(await Student.exists({ _id: req.params.studentId }))) return res.status(404).json({ message: 'Student not found' });
  const doc = await ReportComment.findOneAndUpdate(
    { student: req.params.studentId, term: termId || null },
    { comment, author: req.user._id },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await audit(req, 'REPORT_COMMENT', 'Student', req.params.studentId, { termId });
  res.json({ comment: doc.comment });
}));

router.helpers = { buildModules, typeTotals, averageOf, rankClass, suggestComment };
module.exports = router;