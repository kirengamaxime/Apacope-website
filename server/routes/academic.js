const router = require('express').Router();
const {
  AcademicYear, Term, Trade, Class, Module, LearningOutcome, Assignment,
} = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap } = require('../utils/helpers');

router.use(protect);

/** Small CRUD factory: everyone signed in may read, only `writers` may change. */
function crud(path, Model, { writers = ['dos', 'headteacher'], populate = '', sort = { createdAt: -1 }, filterKeys = [] } = {}) {
  router.get(`/${path}`, wrap(async (req, res) => {
    const q = {};
    filterKeys.forEach((k) => { if (req.query[k]) q[k] = req.query[k]; });
    res.json(await Model.find(q).populate(populate).sort(sort).limit(500));
  }));
  router.post(`/${path}`, authorize(...writers), wrap(async (req, res) => {
    const doc = await Model.create(req.body);
    await audit(req, `${path.toUpperCase()}_CREATE`, Model.modelName, doc._id);
    res.status(201).json(doc);
  }));
  router.put(`/${path}/:id`, authorize(...writers), wrap(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    await audit(req, `${path.toUpperCase()}_UPDATE`, Model.modelName, doc._id);
    res.json(doc);
  }));
  router.delete(`/${path}/:id`, authorize(...writers), wrap(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    await audit(req, `${path.toUpperCase()}_DELETE`, Model.modelName, req.params.id);
    res.json({ message: 'Deleted' });
  }));
}

crud('years', AcademicYear, { sort: { name: -1 } });
crud('terms', Term, { populate: 'academicYear', filterKeys: ['academicYear'] });
crud('trades', Trade, { sort: { name: 1 } });
crud('classes', Class, { populate: 'trade classTeacher', sort: { name: 1 }, filterKeys: ['academicYear', 'trade', 'level'] });
crud('modules', Module, { populate: 'trade', sort: { name: 1 }, filterKeys: ['trade', 'level'] });
crud('outcomes', LearningOutcome, { populate: 'module', filterKeys: ['module'] });
crud('assignments', Assignment, { populate: 'trainer class module', filterKeys: ['trainer', 'class'] });

/** Classes visible to the current user (trainers only see assigned classes) */
router.get('/my-classes', wrap(async (req, res) => {
  if (req.user.role === 'trainer') {
    const a = await Assignment.find({ trainer: req.user._id }).populate('class module');
    const seen = new Map();
    a.forEach((x) => x.class && seen.set(String(x.class._id), x.class));
    return res.json({ classes: [...seen.values()], assignments: a });
  }
  const classes = await Class.find().populate('trade').sort({ name: 1 });
  res.json({ classes, assignments: [] });
}));

module.exports = router;
