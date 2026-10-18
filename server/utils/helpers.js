const { AttendanceRule } = require('../models');

const DEFAULT_THRESHOLDS = [
  { minAbsences: 0, status: 'Normal', action: 'No action needed' },
  { minAbsences: 3, status: 'Follow-up', action: 'Trainer follow-up with student' },
  { minAbsences: 5, status: 'High Priority', action: 'Contact parent/guardian' },
  { minAbsences: 8, status: 'Urgent', action: 'Management review' },
];

async function getRules() {
  let rules = await AttendanceRule.findOne();
  if (!rules) rules = await AttendanceRule.create({ thresholds: DEFAULT_THRESHOLDS });
  return rules;
}

/** Map an absence count to {status, action} using the configurable thresholds */
function classifyAbsences(count, thresholds) {
  const sorted = [...thresholds].sort((a, b) => a.minAbsences - b.minAbsences);
  let hit = sorted[0] || { status: 'Normal', action: '' };
  for (const t of sorted) if (count >= t.minAbsences) hit = t;
  return { status: hit.status, action: hit.action };
}

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

/** Attendance % counts present, late and excused as attended */
const pct = (attended, total) => (total ? Math.round((attended / total) * 1000) / 10 : 0);

/** Rwandan TVET-style grading helper (competency based) */
function gradeFor(percent) {
  if (percent >= 80) return { grade: 'A', remark: 'Excellent' };
  if (percent >= 70) return { grade: 'B', remark: 'Very good' };
  if (percent >= 60) return { grade: 'C', remark: 'Good' };
  if (percent >= 50) return { grade: 'D', remark: 'Competent' };
  return { grade: 'E', remark: 'Not yet competent' };
}

/** Parse pagination from query */
function paging(q, defLimit = 20) {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Wrap async route handlers */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  DEFAULT_THRESHOLDS, getRules, classifyAbsences, startOfDay, endOfDay,
  startOfMonth, endOfMonth, pct, gradeFor, paging, wrap,
};
