const router = require('express').Router();
const { InventoryItem, Loan } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, paging } = require('../utils/helpers');

router.use(protect, authorize('librarian', 'headteacher', 'dos'));

router.get('/items', wrap(async (req, res) => {
  const { page, limit, skip } = paging(req.query, 25);
  const q = {};
  if (req.query.category) q.category = req.query.category;
  if (req.query.search) q.name = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([InventoryItem.find(q).sort({ name: 1 }).skip(skip).limit(limit), InventoryItem.countDocuments(q)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

router.post('/items', authorize('librarian'), wrap(async (req, res) => {
  const item = await InventoryItem.create({ ...req.body, available: req.body.quantity ?? 1 });
  await audit(req, 'INVENTORY_ADD', 'InventoryItem', item._id, { name: item.name });
  res.status(201).json(item);
}));

router.put('/items/:id', authorize('librarian'), wrap(async (req, res) => {
  const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await audit(req, 'INVENTORY_UPDATE', 'InventoryItem', req.params.id);
  res.json(item);
}));

router.get('/loans', wrap(async (req, res) => {
  const q = {};
  if (req.query.open === 'true') q.returnedAt = { $exists: false };
  res.json(await Loan.find(q).populate('item', 'name tag').populate('borrower', 'name role').sort({ borrowedAt: -1 }).limit(200));
}));

router.post('/loans', authorize('librarian'), wrap(async (req, res) => {
  const { itemId, borrowerId, quantity = 1, dueAt } = req.body;
  const item = await InventoryItem.findOneAndUpdate(
    { _id: itemId, available: { $gte: quantity } }, { $inc: { available: -quantity } }, { new: true },
  );
  if (!item) return res.status(400).json({ message: 'Not enough items available' });
  const loan = await Loan.create({ item: itemId, borrower: borrowerId, quantity, dueAt });
  await audit(req, 'LOAN_CREATE', 'Loan', loan._id, { item: item.name, borrower: borrowerId });
  res.status(201).json(loan);
}));

// Return (optionally record damage)
router.put('/loans/:id/return', authorize('librarian'), wrap(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan || loan.returnedAt) return res.status(400).json({ message: 'Loan not found or already returned' });
  loan.returnedAt = new Date();
  loan.damaged = !!req.body.damaged;
  loan.damageNote = req.body.damageNote;
  await loan.save();
  const update = { $inc: { available: loan.damaged ? 0 : loan.quantity } };
  if (loan.damaged) update.$set = { condition: 'damaged' };
  await InventoryItem.updateOne({ _id: loan.item }, update);
  await audit(req, 'LOAN_RETURN', 'Loan', loan._id, { damaged: loan.damaged });
  res.json(loan);
}));

module.exports = router;
