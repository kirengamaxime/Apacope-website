const mongoose = require('mongoose');

const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

/**
 * One record per class + module + term. Tracks where the marks are in the workflow:
 * draft (trainer is entering) -> submitted (waiting for the DOS) -> approved, or returned (trainer must correct and resubmit).
 */
const schema = new Schema({
  class: oid('Class', { required: true }),
  module: oid('Module', { required: true }),
  term: oid('Term'),
  trainer: oid('User'),
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'returned'], default: 'draft', index: true },
  submittedAt: Date,
  reviewedAt: Date,
  reviewedBy: oid('User'),
  reviewComment: String,
}, { timestamps: true });
schema.index({ class: 1, module: 1, term: 1 }, { unique: true });

module.exports = mongoose.models.MarkSubmission || mongoose.model('MarkSubmission', schema);