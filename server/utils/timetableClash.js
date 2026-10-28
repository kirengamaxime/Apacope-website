/*
 * Double-booking checks for the timetable.
 * Two slots clash when they are on the same day, their times overlap (not just touch) and they share
 *   - the same trainer, or
 *   - the same room (names are compared ignoring case and extra spaces), or
 *   - the same class.
 */
const { Timetable } = require('../models');

const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const sameId = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
const roomKey = (r) => String(r || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** true when the two slots are on the same day and their times overlap */
function overlaps(a, b) {
  if (Number(a.day) !== Number(b.day)) return false;
  const as = toMin(a.startTime); const ae = toMin(a.endTime); const bs = toMin(b.startTime); const be = toMin(b.endTime);
  if ([as, ae, bs, be].some((v) => v === null)) return false;
  return as < be && bs < ae;
}

/** Which kinds of clash do these two slots have? ([] when none) */
function clashKinds(a, b) {
  if (!overlaps(a, b)) return [];
  const kinds = [];
  if (a.trainer && sameId(a.trainer, b.trainer)) kinds.push('trainer');
  if (roomKey(a.room) && roomKey(a.room) === roomKey(b.room)) kinds.push('room');
  if (a.class && sameId(a.class, b.class)) kinds.push('class');
  return kinds;
}

const KIND_TEXT = { trainer: 'The trainer is already teaching', room: 'The room is already used by', class: 'The class already has' };

const brief = (s) => ({
  _id: s._id, day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room || '',
  class: s.class?.name || '', module: s.module?.name || '', trainer: s.trainer?.name || '',
});

/** Check a proposed slot against every saved slot. excludeId = the slot being edited. */
async function findClashes(slot, excludeId = null) {
  const others = await Timetable.find({ day: slot.day, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .populate('class', 'name').populate('module', 'name').populate('trainer', 'name');
  const out = [];
  others.forEach((o) => {
    clashKinds(slot, o).forEach((kind) => {
      const b = brief(o);
      out.push({ kind, slot: b, message: `${KIND_TEXT[kind]} ${b.class} - ${b.module} (${b.startTime}-${b.endTime}${b.room ? `, ${b.room}` : ''})` });
    });
  });
  return out;
}

/** Every clash that already exists in the saved timetable (for the warning banner) */
async function allClashes() {
  const slots = await Timetable.find({}).populate('class', 'name').populate('module', 'name').populate('trainer', 'name');
  const out = [];
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      clashKinds(slots[i], slots[j]).forEach((kind) => out.push({ kind, a: brief(slots[i]), b: brief(slots[j]) }));
    }
  }
  return out;
}

module.exports = { toMin, overlaps, clashKinds, findClashes, allClashes };