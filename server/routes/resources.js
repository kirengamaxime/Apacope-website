const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { Resource, ResourceActivity, Bookmark, Student, Class, Assignment } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { upload, ALLOWED } = require('../middleware/upload');
const { wrap, paging } = require('../utils/helpers');

router.use(protect);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const YT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

/** Build the visibility filter: only targeted students (and staff) see a resource */
async function visibilityFilter(user) {
  if (user.role === 'student') {
    const s = await Student.findOne({ user: user._id }).populate('class');
    if (!s) return { _id: null };
    const cls = s.class;
    return {
      approved: true,
      $or: [
        { classes: cls._id },
        { classes: { $size: 0 }, level: cls.level, trade: cls.trade },
        { category: 'entertainment', classes: { $size: 0 } },
      ],
    };
  }
  if (user.role === 'parent') return { _id: null };
  if (user.role === 'trainer') return { $or: [{ uploadedBy: user._id }, { approved: true }] };
  return {};
}

// List/search
router.get('/', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 12);
  const and = [await visibilityFilter(req.user)];
  if (req.query.category) and.push({ category: req.query.category });
  if (req.query.kind) and.push({ kind: req.query.kind });
  if (req.query.module) and.push({ module: req.query.module });
  if (req.query.entertainmentType) and.push({ entertainmentType: req.query.entertainmentType });
  if (req.query.pending === 'true' && ['dos', 'headteacher', 'admin'].includes(req.user.role)) and.push({ approved: false });
  if (req.query.search) {
    const r = new RegExp(esc(req.query.search), 'i');
    and.push({ $or: [{ title: r }, { description: r }] });
  }
  if (req.query.bookmarked === 'true') {
    const marks = await Bookmark.find({ user: req.user._id }).select('resource');
    and.push({ _id: { $in: marks.map((b) => b.resource) } });
  }
  const q = { $and: and };
  const [items, total, marks] = await Promise.all([
    Resource.find(q).populate('module', 'name').populate('uploadedBy', 'name').populate('classes', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Resource.countDocuments(q),
    Bookmark.find({ user: req.user._id }).select('resource'),
  ]);
  const bm = new Set(marks.map((b) => String(b.resource)));
  res.json({ items: items.map((r) => ({ ...r.toObject(), bookmarked: bm.has(String(r._id)) })), total, page, pages: Math.ceil(total / limit) });
}));

// Upload / post. Trainers must pick class, level, trade, module and learning outcome.
router.post('/', authorize('trainer', 'dos', 'headteacher'), upload.single('file'), wrap(async (req, res) => {
  const b = req.body;
  const category = b.category === 'entertainment' ? 'entertainment' : 'lesson';
  let classes = [];
  try { classes = JSON.parse(b.classes || '[]'); } catch { classes = b.classes ? [b.classes] : []; }

  if (category === 'lesson') {
    if (!classes.length || !b.level || !b.trade || !b.module || !b.learningOutcome) {
      return res.status(400).json({ message: 'Select Class, Level, Trade, Module and Learning Outcome' });
    }
    if (req.user.role === 'trainer') {
      const okCount = await Assignment.countDocuments({ trainer: req.user._id, class: { $in: classes }, module: b.module });
      if (!okCount) return res.status(403).json({ message: 'You are not assigned to teach this module in the selected class' });
    }
  }
  const doc = {
    title: b.title, description: b.description, category,
    entertainmentType: category === 'entertainment' ? b.entertainmentType : undefined,
    classes, level: b.level || undefined, trade: b.trade || undefined,
    module: b.module || undefined, learningOutcome: b.learningOutcome || undefined,
    uploadedBy: req.user._id,
    // entertainment must be moderated before students can see it
    approved: category === 'entertainment' ? ['dos', 'headteacher', 'admin'].includes(req.user.role) : true,
  };
  if (b.youtubeUrl) {
    if (!YT.test(b.youtubeUrl)) return res.status(400).json({ message: 'Enter a valid YouTube link' });
    doc.kind = 'video'; doc.youtubeUrl = b.youtubeUrl;
  } else if (req.file) {
    doc.kind = ALLOWED[req.file.mimetype];
    doc.file = { path: req.file.filename, originalName: req.file.originalname, mime: req.file.mimetype, size: req.file.size };
  } else {
    return res.status(400).json({ message: 'Attach a file or provide a YouTube link' });
  }
  const r = await Resource.create(doc);
  await audit(req, 'RESOURCE_UPLOAD', 'Resource', r._id, { title: r.title, kind: r.kind, category });
  res.status(201).json(r);
}));

// Moderation of entertainment content
router.put('/:id/approve', authorize('dos', 'headteacher'), wrap(async (req, res) => {
  const r = await Resource.findByIdAndUpdate(req.params.id, { approved: req.body.approved !== false }, { new: true });
  await audit(req, 'RESOURCE_MODERATE', 'Resource', req.params.id, { approved: r.approved });
  res.json(r);
}));

router.delete('/:id', authorize('trainer', 'dos', 'headteacher'), wrap(async (req, res) => {
  const r = await Resource.findById(req.params.id);
  if (!r) return res.status(404).json({ message: 'Not found' });
  if (req.user.role === 'trainer' && String(r.uploadedBy) !== String(req.user._id)) return res.status(403).json({ message: 'Not your upload' });
  if (r.file?.path) fs.unlink(path.join(__dirname, '..', 'uploads', r.file.path), () => {});
  await r.deleteOne();
  await audit(req, 'RESOURCE_DELETE', 'Resource', req.params.id, { title: r.title });
  res.json({ message: 'Deleted' });
}));

async function mustSee(req, id) {
  const r = await Resource.findOne({ $and: [{ _id: id }, await visibilityFilter(req.user)] });
  return r;
}

// View (logs history)
router.post('/:id/view', wrap(async (req, res) => {
  const r = await mustSee(req, req.params.id);
  if (!r) return res.status(404).json({ message: 'Not found' });
  await ResourceActivity.create({ resource: r._id, user: req.user._id, action: 'view' });
  res.json({ ok: true });
}));

// Download (streams file, logs history)
router.get('/:id/download', wrap(async (req, res) => {
  const r = await mustSee(req, req.params.id);
  if (!r || !r.file?.path) return res.status(404).json({ message: 'Not found' });
  const full = path.join(__dirname, '..', 'uploads', path.basename(r.file.path));
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'File missing' });
  await ResourceActivity.create({ resource: r._id, user: req.user._id, action: 'download' });
  await Resource.updateOne({ _id: r._id }, { $inc: { downloads: 1 } });
  res.setHeader('Content-Type', r.file.mime);
  const inline = req.query.inline === '1';
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(r.file.originalName)}"`);
  fs.createReadStream(full).pipe(res);
}));

// Bookmarks
router.post('/:id/bookmark', wrap(async (req, res) => {
  const exists = await Bookmark.findOne({ user: req.user._id, resource: req.params.id });
  if (exists) { await exists.deleteOne(); return res.json({ bookmarked: false }); }
  await Bookmark.create({ user: req.user._id, resource: req.params.id });
  res.json({ bookmarked: true });
}));

// My view/download history
router.get('/history/me', wrap(async (req, res) => {
  res.json(await ResourceActivity.find({ user: req.user._id }).populate('resource', 'title kind').sort({ createdAt: -1 }).limit(50));
}));

module.exports = router;
