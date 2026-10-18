const router = require('express').Router();
const { Invoice, Payment, Student } = require('../models');
const { protect, authorize, visibleStudentIds } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, paging } = require('../utils/helpers');

router.use(protect);

// Parents/students may see their own invoices only; staff finance roles see all
router.get('/invoices', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 25);
  const q = {};
  const ids = await visibleStudentIds(req.user);
  if (ids) q.student = { $in: ids };
  else if (!['accountant', 'headteacher'].includes(req.user.role) && req.user.role !== 'admin') return res.status(403).json({ message: 'Not allowed' });
  if (req.query.status) q.status = req.query.status;
  if (req.query.student && !ids) q.student = req.query.student;
  const [items, total] = await Promise.all([
    Invoice.find(q).populate('student', 'firstName lastName admissionNo').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(q),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

router.post('/invoices', authorize('accountant'), wrap(async (req, res) => {
  const inv = await Invoice.create(req.body);
  await audit(req, 'INVOICE_CREATE', 'Invoice', inv._id, { amount: inv.amount, student: inv.student });
  res.status(201).json(inv);
}));

// Bulk invoice a whole class
router.post('/invoices/bulk', authorize('accountant'), wrap(async (req, res) => {
  const { classId, amount, description, termId, dueDate } = req.body;
  const students = await Student.find({ class: classId, status: 'active' }).select('_id');
  const docs = await Invoice.insertMany(students.map((s) => ({ student: s._id, amount, description, term: termId, dueDate })));
  await audit(req, 'INVOICE_BULK_CREATE', 'Invoice', classId, { count: docs.length, amount });
  res.status(201).json({ created: docs.length });
}));

// Record a payment and issue a receipt number
router.post('/payments', authorize('accountant'), wrap(async (req, res) => {
  const { invoiceId, amount, method } = req.body;
  const inv = await Invoice.findById(invoiceId);
  if (!inv) return res.status(404).json({ message: 'Invoice not found' });
  const balance = inv.amount - inv.paid;
  if (amount <= 0 || amount > balance) return res.status(400).json({ message: `Amount must be between 1 and ${balance}` });
  const count = await Payment.countDocuments();
  const pay = await Payment.create({
    invoice: inv._id, student: inv.student, amount, method,
    receiptNo: `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
    receivedBy: req.user._id,
  });
  inv.paid += amount;
  inv.status = inv.paid >= inv.amount ? 'paid' : 'partial';
  await inv.save();
  await audit(req, 'PAYMENT_RECORD', 'Payment', pay._id, { receiptNo: pay.receiptNo, amount });
  res.status(201).json(pay);
}));

router.get('/payments', wrap(async (req, res) => {
  const q = {};
  const ids = await visibleStudentIds(req.user);
  if (ids) q.student = { $in: ids };
  else if (!['accountant', 'headteacher', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Not allowed' });
  res.json(await Payment.find(q).populate('student', 'firstName lastName admissionNo').sort({ createdAt: -1 }).limit(100));
}));

// Balances summary
router.get('/summary', authorize('accountant', 'headteacher'), wrap(async (req, res) => {
  const [row] = await Invoice.aggregate([{ $group: { _id: null, billed: { $sum: '$amount' }, collected: { $sum: '$paid' } } }]);
  const billed = row?.billed || 0;
  const collected = row?.collected || 0;
  res.json({ billed, collected, outstanding: billed - collected });
}));

module.exports = router;
