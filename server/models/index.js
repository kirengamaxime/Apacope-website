const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });

const ROLES = [
  'admin', 'headteacher', 'dos', 'trainer',
  'student', 'parent', 'accountant', 'librarian',
];

/* ---------- Role (permission sets, editable by admin) ---------- */
const roleSchema = new Schema({
  name: { type: String, enum: ROLES, unique: true, required: true },
  label: String,
  permissions: [String],
}, { timestamps: true });

/* ---------- User ---------- */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: String,
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ROLES, required: true, index: true },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resetToken: { type: String, select: false },
  resetExpires: { type: Date, select: false },
  lastLogin: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.set('toJSON', { transform: (_d, r) => { delete r.password; delete r.resetToken; delete r.resetExpires; return r; } });
userSchema.methods.matches = function (plain) { return bcrypt.compare(plain, this.password); };

/* ---------- Academic structure ---------- */
const academicYearSchema = new Schema({
  name: { type: String, required: true, unique: true }, // e.g. 2026
  startDate: Date, endDate: Date,
  current: { type: Boolean, default: false },
}, { timestamps: true });

const termSchema = new Schema({
  academicYear: oid('AcademicYear', { required: true }),
  name: { type: String, required: true }, // Term 1
  startDate: Date, endDate: Date,
  current: { type: Boolean, default: false },
}, { timestamps: true });

const tradeSchema = new Schema({
  name: { type: String, required: true, unique: true }, // Software Development
  code: String,
}, { timestamps: true });

const classSchema = new Schema({
  name: { type: String, required: true }, // L4 SOD A
  level: { type: String, required: true }, // L3, L4, L5
  trade: oid('Trade', { required: true }),
  academicYear: oid('AcademicYear', { required: true }),
  classTeacher: oid('User'),
}, { timestamps: true });
classSchema.index({ academicYear: 1, trade: 1, level: 1 });

const moduleSchema = new Schema({
  name: { type: String, required: true },
  code: String,
  trade: oid('Trade', { required: true }),
  level: String,
  credits: Number,
}, { timestamps: true });
moduleSchema.index({ trade: 1, level: 1 });

const learningOutcomeSchema = new Schema({
  module: oid('Module', { required: true, index: true }),
  title: { type: String, required: true },
  description: String,
}, { timestamps: true });

/* trainer <-> class <-> module assignment */
const assignmentSchema = new Schema({
  trainer: oid('User', { required: true, index: true }),
  class: oid('Class', { required: true, index: true }),
  module: oid('Module', { required: true }),
}, { timestamps: true });
assignmentSchema.index({ trainer: 1, class: 1, module: 1 }, { unique: true });

/* ---------- Student & Parent ---------- */
const studentSchema = new Schema({
  user: oid('User', { index: true }), // login account (optional)
  admissionNo: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  gender: { type: String, enum: ['M', 'F'] },
  dob: Date,
  class: oid('Class', { required: true, index: true }),
  parents: [oid('Parent')],
  status: { type: String, enum: ['active', 'transferred', 'graduated', 'dropped'], default: 'active' },
}, { timestamps: true });
studentSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });

const parentSchema = new Schema({
  user: oid('User', { required: true, index: true }),
  children: [oid('Student')],
  relationship: String,
  occupation: String,
  address: String,
}, { timestamps: true });

/* ---------- Attendance ---------- */
const attendanceSchema = new Schema({
  student: oid('Student', { required: true }),
  class: oid('Class', { required: true }),
  module: oid('Module'),
  session: { type: String, default: 'Full day' }, // Morning / Afternoon / Period 1...
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
  note: String,
  recordedBy: oid('User'),
}, { timestamps: true });
attendanceSchema.index({ student: 1, date: 1, session: 1, module: 1 }, { unique: true });
attendanceSchema.index({ class: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });

/* Configurable absence rules (single document per school) */
const attendanceRuleSchema = new Schema({
  thresholds: [{
    minAbsences: Number,
    status: { type: String, enum: ['Normal', 'Follow-up', 'High Priority', 'Urgent'] },
    action: String,
  }],
  chronicAbsenceCount: { type: Number, default: 5 },
  goodAttendancePct: { type: Number, default: 90 },
  warnAttendancePct: { type: Number, default: 75 },
}, { timestamps: true });

const followUpSchema = new Schema({
  student: oid('Student', { required: true, index: true }),
  contactedBy: oid('User', { required: true }),
  parentContacted: String,
  method: { type: String, enum: ['phone', 'sms', 'email', 'visit', 'meeting'], default: 'phone' },
  contactDate: { type: Date, default: Date.now },
  discussion: String,
  agreedAction: String,
  resolved: { type: Boolean, default: false },
}, { timestamps: true });

/* ---------- Assessment ---------- */
const assessmentSchema = new Schema({
  student: oid('Student', { required: true }),
  class: oid('Class', { required: true }),
  module: oid('Module', { required: true }),
  term: oid('Term'),
  type: { type: String, enum: ['formative', 'summative', 'comprehensive'], required: true },
  title: String,
  score: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 1 },
  competent: Boolean,
  enteredBy: oid('User'),
}, { timestamps: true });
assessmentSchema.index({ student: 1, module: 1, term: 1 });
assessmentSchema.index({ class: 1, module: 1 });

/* ---------- eLearning resources ---------- */
const resourceSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  kind: { type: String, enum: ['video', 'pdf', 'word', 'image', 'link'], required: true },
  youtubeUrl: String,
  file: { path: String, originalName: String, mime: String, size: Number },
  // content targeting
  classes: [oid('Class')],
  level: String,
  trade: oid('Trade'),
  module: oid('Module'),
  learningOutcome: oid('LearningOutcome'),
  category: { type: String, enum: ['lesson', 'entertainment'], default: 'lesson' },
  entertainmentType: { type: String, enum: ['documentary', 'career', 'quiz', 'event'] },
  approved: { type: Boolean, default: true }, // entertainment requires moderation
  uploadedBy: oid('User', { required: true }),
  downloads: { type: Number, default: 0 },
}, { timestamps: true });
resourceSchema.index({ classes: 1, module: 1 });
resourceSchema.index({ title: 'text', description: 'text' });

const resourceActivitySchema = new Schema({
  resource: oid('Resource', { required: true, index: true }),
  user: oid('User', { required: true, index: true }),
  action: { type: String, enum: ['view', 'download'], required: true },
}, { timestamps: true });

const bookmarkSchema = new Schema({
  resource: oid('Resource', { required: true }),
  user: oid('User', { required: true }),
}, { timestamps: true });
bookmarkSchema.index({ user: 1, resource: 1 }, { unique: true });

/* ---------- Timetable & Calendar ---------- */
const timetableSchema = new Schema({
  class: oid('Class', { required: true, index: true }),
  module: oid('Module', { required: true }),
  trainer: oid('User', { required: true }),
  day: { type: Number, min: 1, max: 7, required: true }, // 1=Mon
  startTime: String, endTime: String,
  room: String,
  type: { type: String, enum: ['lesson', 'practical', 'exam'], default: 'lesson' },
}, { timestamps: true });

const eventSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['term', 'holiday', 'exam', 'meeting', 'makerspace', 'other'], default: 'other' },
  start: { type: Date, required: true },
  end: Date,
  description: String,
  createdBy: oid('User'),
}, { timestamps: true });

/* ---------- Announcements ---------- */
const announcementSchema = new Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: oid('User', { required: true }),
  audienceRoles: [{ type: String, enum: ROLES }], // empty + schoolWide
  schoolWide: { type: Boolean, default: false },
  classes: [oid('Class')],
  requiresAck: { type: Boolean, default: false },
  acknowledgements: [{ user: oid('User'), at: { type: Date, default: Date.now } }],
  kind: { type: String, enum: ['announcement', 'class-message', 'parent-alert'], default: 'announcement' },
  forStudent: oid('Student'),
}, { timestamps: true });
announcementSchema.index({ createdAt: -1 });

/* ---------- Finance ---------- */
const invoiceSchema = new Schema({
  student: oid('Student', { required: true, index: true }),
  term: oid('Term'),
  description: String,
  amount: { type: Number, required: true },
  paid: { type: Number, default: 0 },
  dueDate: Date,
  status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
}, { timestamps: true });

const paymentSchema = new Schema({
  invoice: oid('Invoice', { required: true, index: true }),
  student: oid('Student', { required: true }),
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'bank', 'momo'], default: 'cash' },
  receiptNo: { type: String, unique: true },
  receivedBy: oid('User'),
}, { timestamps: true });

/* ---------- Inventory ---------- */
const inventoryItemSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['computer', 'lab', 'tool', 'book', 'other'], default: 'other' },
  tag: { type: String, unique: true, sparse: true },
  quantity: { type: Number, default: 1 },
  available: { type: Number, default: 1 },
  condition: { type: String, enum: ['good', 'fair', 'damaged'], default: 'good' },
}, { timestamps: true });

const loanSchema = new Schema({
  item: oid('InventoryItem', { required: true, index: true }),
  borrower: oid('User', { required: true }),
  quantity: { type: Number, default: 1 },
  borrowedAt: { type: Date, default: Date.now },
  dueAt: Date,
  returnedAt: Date,
  damaged: { type: Boolean, default: false },
  damageNote: String,
}, { timestamps: true });

/* ---------- Audit log ---------- */
const auditLogSchema = new Schema({
  user: oid('User', { index: true }),
  userName: String,
  role: String,
  action: { type: String, required: true }, // e.g. ATTENDANCE_EDIT
  entity: String,
  entityId: String,
  details: Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

/* ---------- Public website contact / admission enquiries ---------- */
const contactMessageSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 40 },
  topic: { type: String, enum: ['admission', 'general', 'fees', 'other'], default: 'general' },
  message: { type: String, required: true, maxlength: 2000 },
  read: { type: Boolean, default: false },
}, { timestamps: true });
contactMessageSchema.index({ createdAt: -1 });

const m = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  ROLES,
  Role: m('Role', roleSchema),
  User: m('User', userSchema),
  AcademicYear: m('AcademicYear', academicYearSchema),
  Term: m('Term', termSchema),
  Trade: m('Trade', tradeSchema),
  Class: m('Class', classSchema),
  Module: m('Module', moduleSchema),
  LearningOutcome: m('LearningOutcome', learningOutcomeSchema),
  Assignment: m('Assignment', assignmentSchema),
  Student: m('Student', studentSchema),
  Parent: m('Parent', parentSchema),
  Attendance: m('Attendance', attendanceSchema),
  AttendanceRule: m('AttendanceRule', attendanceRuleSchema),
  FollowUp: m('FollowUp', followUpSchema),
  Assessment: m('Assessment', assessmentSchema),
  Resource: m('Resource', resourceSchema),
  ResourceActivity: m('ResourceActivity', resourceActivitySchema),
  Bookmark: m('Bookmark', bookmarkSchema),
  Timetable: m('Timetable', timetableSchema),
  Event: m('Event', eventSchema),
  Announcement: m('Announcement', announcementSchema),
  Invoice: m('Invoice', invoiceSchema),
  Payment: m('Payment', paymentSchema),
  InventoryItem: m('InventoryItem', inventoryItemSchema),
  Loan: m('Loan', loanSchema),
  AuditLog: m('AuditLog', auditLogSchema),
  ContactMessage: m('ContactMessage', contactMessageSchema),
};
