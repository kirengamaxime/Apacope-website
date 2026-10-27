/*
 * Which recorded marks may appear on an official document (report card)?
 *   - marks of a class + module + term whose sheet the DOS approved,
 *   - marks that were entered before the approval step existed (no sheet at all),
 *   - the marks that stay visible after a sheet was re-opened to add a new assessment (entered before approvedUpTo),
 *   - marks created from an online assignment (the DOS approved the assignment).
 * It is the same rule the Results page applies to learners and parents.
 */
const MarkSubmission = require('../models/MarkSubmission');
const { OnlineSubmission } = require('../models/OnlineAssignment');

const idOf = (v) => String(v?._id || v || '');

/** Returns { rows, online } where online is a Set of the assessment ids that came from an online assignment */
async function approvedOnly(rows) {
  if (!rows.length) return { rows: [], online: new Set() };
  const online = new Set((await OnlineSubmission.find({ assessment: { $in: rows.map((r) => r._id) } }).select('assessment')).map((s) => String(s.assessment)));
  const subs = await MarkSubmission.find({ class: { $in: [...new Set(rows.map((r) => idOf(r.class)))] } }).select('class module term status approvedUpTo');
  const key = (x) => `${idOf(x.class)}|${idOf(x.module)}|${idOf(x.term)}`;
  const blocked = new Map(subs.filter((x) => x.status !== 'approved').map((x) => [key(x), x.approvedUpTo ? new Date(x.approvedUpTo).getTime() : 0]));
  const kept = rows.filter((r) => online.has(String(r._id)) || !blocked.has(key(r)) || new Date(r.createdAt).getTime() <= blocked.get(key(r)));
  return { rows: kept, online };
}

module.exports = { approvedOnly };