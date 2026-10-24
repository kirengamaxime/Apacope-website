const mongoose = require('mongoose');

const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

/**
 * An assignment the trainer writes inside the platform. Learners answer it on screen (nothing to download).
 *   marksStatus: open (learners answering / trainer marking) -> pending (sent to the DOS) -> approved, or returned (trainer corrects)
 */
const questionSchema = new Schema({
  text: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'choice'], default: 'text' },
  options: [String],          // for choice questions
  correct: Number,            // index of the right option (choice questions are marked automatically)
  points: { type: Number, required: true, min: 0.5, default: 1 },
});

const assignmentSchema = new Schema({
  title: { type: String, required: true, trim: true },
  instructions: { type: String, trim: true },
  class: oid('Class', { required: true, index: true }),
  module: oid('Module', { required: true }),
  term: oid('Term'),
  trainer: oid('User', { required: true, index: true }),
  students: [oid('Student')],   // the learners who receive it
  dueDate: Date,
  questions: [questionSchema],
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  marksStatus: { type: String, enum: ['open', 'pending', 'approved', 'returned'], default: 'open', index: true },
  sentAt: Date,
  reviewedAt: Date,
  reviewedBy: oid('User'),
  reviewComment: String,
}, { timestamps: true });
assignmentSchema.index({ students: 1, status: 1 });

const submissionSchema = new Schema({
  assignment: oid('OnlineAssignment', { required: true, index: true }),
  student: oid('Student', { required: true }),
  answers: [{ question: Schema.Types.ObjectId, answer: String, _id: false }],
  status: { type: String, enum: ['started', 'submitted'], default: 'started' },
  submittedAt: Date,
  scores: [{ question: Schema.Types.ObjectId, score: Number, comment: String, _id: false }],
  total: { type: Number, default: 0 },
  marked: { type: Boolean, default: false },
  markedAt: Date,
  feedback: String,
}, { timestamps: true });
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = {
  OnlineAssignment: mongoose.models.OnlineAssignment || mongoose.model('OnlineAssignment', assignmentSchema),
  OnlineSubmission: mongoose.models.OnlineSubmission || mongoose.model('OnlineSubmission', submissionSchema),
};