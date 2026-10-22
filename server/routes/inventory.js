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
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  const { name, category, tag, condition, quantity } = req.body;
  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (tag !== undefined) item.tag = tag || undefined;
  if (condition !== undefined) item.condition = condition;
  if (quantity !== undefined) {
    const q = Number(quantity);
    const onLoan = item.quantity - item.available;
    if (!(q >= 1) || q < onLoan) return res.status(400).json({ message: `Quantity cannot be less than the ${onLoan} currently on loan` });
    item.quantity = q;
    item.available = q - onLoan;
  }
  await item.save();
  await audit(req, 'INVENTORY_UPDATE', 'InventoryItem', item._id);
  res.json(item);
}));

router.delete('/items/:id', authorize('librarian'), wrap(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  if (await Loan.exists({ item: item._id, returnedAt: { $exists: false } })) return res.status(400).json({ message: 'This item is still on loan. Record the return first.' });
  await Loan.deleteMany({ item: item._id });
  await item.deleteOne();
  await audit(req, 'INVENTORY_DELETE', 'InventoryItem', item._id, { name: item.name });
  res.json({ message: 'Item deleted' });
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

// Cancel a loan recorded by mistake (stock goes back if it was still out)
router.delete('/loans/:id', authorize('librarian'), wrap(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) return res.status(404).json({ message: 'Not found' });
  if (!loan.returnedAt) await InventoryItem.updateOne({ _id: loan.item }, { $inc: { available: loan.quantity } });
  await loan.deleteOne();
  await audit(req, 'LOAN_DELETE', 'Loan', loan._id);
  res.json({ message: 'Loan removed' });
}));

module.exports = router;