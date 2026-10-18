const router = require('express').Router();
const {
  Attendance, Student, Announcement, Invoice, Loan, InventoryItem, Resource, User, Assignment, FollowUp,
} = require('../models');
const { protect, visibleStudentIds } = require('../middleware/auth');
const {
  wrap, getRules, startOfDay, endOfDay, startOfMonth, endOfMonth, pct,
} = require('../utils/helpers');

router.use(protect);

async function attendanceCards() {
  const rules = await getRules();
  const todayRows = await Attendance.aggregate([
    { $match: { date: { $gte: startOfDay(), $lte: endOfDay() } } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const t = Object.fromEntries(todayRows.map((r) => [r._id, r.n]));
  const todayTotal = todayRows.reduce((s, r) => s + r.n, 0);
  const absentToday = t.absent || 0;

  const monthRows = await Attendance.aggregate([
    { $match: { date: { $gte: startOfMonth(), $lte: endOfMonth() } } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const monthTotal = monthRows.reduce((s, r) => s + r.n, 0);
  const monthAbsent = monthRows.find((r) => r._id === 'absent')?.n || 0;

  const chronic = await Attendance.aggregate([
    { $match: { status: 'absent', date: { $gte: startOfMonth(), $lte: endOfMonth() } } },
    { $group: { _id: '$student', n: { $sum: 1 } } },
    { $match: { n: { $gte: rules.chronicAbsenceCount } } },
    { $count: 'c' },
  ]);

  // daily trend, last 14 days
  const since = startOfDay(new Date(Date.now() - 13 * 86400000));
  const daily = await Attendance.aggregate([
    { $match: { date: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: 1 }, absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    todayPct: pct(todayTotal - absentToday, todayTotal),
    monthlyAvg: pct(monthTotal - monthAbsent, monthTotal),
    absentToday,
    chronicAbsentees: chronic[0]?.c || 0,
    trend: daily.map((d) => ({ date: d._id.slice(5), attendance: pct(d.total - d.absent, d.total) })),
  };
}

router.get('/', wrap(async (req, res) => {
  const role = req.user.role;
  const out = { role };

  if (['admin', 'headteacher', 'dos'].includes(role)) {
    out.attendance = await attendanceCards();
    out.counts = {
      students: await Student.countDocuments({ status: 'active' }),
      trainers: await User.countDocuments({ role: 'trainer', active: true }),
    };
    out.openFollowUps = await FollowUp.countDocuments({ resolved: false });
  }

  if (role === 'trainer') {
    const a = await Assignment.find({ trainer: req.user._id }).populate('class module');
    out.assignments = a;
    out.recentResources = await Resource.countDocuments({ uploadedBy: req.user._id });
    const today = await Attendance.countDocuments({ recordedBy: req.user._id, date: { $gte: startOfDay(), $lte: endOfDay() } });
    out.attendanceRecordedToday = today;
  }

  if (role === 'student' || role === 'parent') {
    const ids = await visibleStudentIds(req.user);
    const children = await Student.find({ _id: { $in: ids || [] } }).populate('class', 'name');
    out.children = [];
    for (const c of children) {
      const rows = await Attendance.aggregate([
        { $match: { student: c._id, date: { $gte: startOfMonth(), $lte: endOfMonth() } } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]);
      const total = rows.reduce((s, r) => s + r.n, 0);
      const absent = rows.find((r) => r._id === 'absent')?.n || 0;
      const inv = await Invoice.aggregate([{ $match: { student: c._id } }, { $group: { _id: null, billed: { $sum: '$amount' }, paid: { $sum: '$paid' } } }]);
      out.children.push({
        id: c._id, name: `${c.firstName} ${c.lastName}`, className: c.class?.name,
        attendancePct: pct(total - absent, total), absences: absent,
        balance: (inv[0]?.billed || 0) - (inv[0]?.paid || 0),
      });
    }
  }

  if (role === 'accountant') {
    const [row] = await Invoice.aggregate([{ $group: { _id: null, billed: { $sum: '$amount' }, collected: { $sum: '$paid' } } }]);
    const byStatus = await Invoice.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    out.finance = { billed: row?.billed || 0, collected: row?.collected || 0, outstanding: (row?.billed || 0) - (row?.collected || 0), byStatus };
  }

  if (role === 'librarian') {
    out.inventory = {
      items: await InventoryItem.countDocuments(),
      onLoan: await Loan.countDocuments({ returnedAt: { $exists: false } }),
      damaged: await InventoryItem.countDocuments({ condition: 'damaged' }),
    };
  }

  if (role === 'headteacher' || role === 'admin') {
    const [row] = await Invoice.aggregate([{ $group: { _id: null, billed: { $sum: '$amount' }, collected: { $sum: '$paid' } } }]);
    out.finance = { billed: row?.billed || 0, collected: row?.collected || 0, outstanding: (row?.billed || 0) - (row?.collected || 0) };
    out.pendingModeration = await Resource.countDocuments({ approved: false });
  }

  res.json(out);
}));

module.exports = router;
