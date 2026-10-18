const router = require('express').Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Attendance, Student, Invoice } = require('../models');
const { protect, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { wrap, startOfDay, endOfDay, startOfMonth, endOfMonth, pct } = require('../utils/helpers');

router.use(protect);

/** Each report returns { title, columns:[{header,key,width}], rows:[...] } */
const builders = {
  async attendance(req) {
    const from = req.query.from ? startOfDay(new Date(req.query.from)) : startOfMonth();
    const to = req.query.to ? endOfDay(new Date(req.query.to)) : endOfMonth();
    const match = { date: { $gte: from, $lte: to } };
    if (req.query.class) match.class = require('mongoose').Types.ObjectId.createFromHexString(req.query.class);
    const rows = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$student', total: { $sum: 1 }, absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } } } },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 's' } }, { $unwind: '$s' },
      { $sort: { 's.lastName': 1 } },
    ]);
    return {
      title: `Attendance report (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)})`,
      columns: [
        { header: 'Admission No', key: 'adm', width: 16 }, { header: 'Student', key: 'name', width: 30 },
        { header: 'Sessions', key: 'total', width: 10 }, { header: 'Absent', key: 'absent', width: 10 },
        { header: 'Late', key: 'late', width: 10 }, { header: 'Attendance %', key: 'pct', width: 14 },
      ],
      rows: rows.map((r) => ({ adm: r.s.admissionNo, name: `${r.s.firstName} ${r.s.lastName}`, total: r.total, absent: r.absent, late: r.late, pct: pct(r.total - r.absent, r.total) })),
    };
  },
  async admissions(req) {
    const q = {};
    if (req.query.class) q.class = req.query.class;
    const list = await Student.find(q).populate('class', 'name').sort({ lastName: 1 });
    return {
      title: 'Admission list',
      columns: [
        { header: 'Admission No', key: 'adm', width: 16 }, { header: 'Name', key: 'name', width: 30 },
        { header: 'Gender', key: 'g', width: 8 }, { header: 'Class', key: 'c', width: 18 }, { header: 'Status', key: 's', width: 12 },
      ],
      rows: list.map((s) => ({ adm: s.admissionNo, name: `${s.firstName} ${s.lastName}`, g: s.gender, c: s.class?.name, s: s.status })),
    };
  },
  async financial() {
    const list = await Invoice.find().populate('student', 'firstName lastName admissionNo').sort({ createdAt: -1 }).limit(2000);
    return {
      title: 'Financial report - fees and balances',
      columns: [
        { header: 'Admission No', key: 'adm', width: 16 }, { header: 'Student', key: 'name', width: 28 },
        { header: 'Billed', key: 'billed', width: 12 }, { header: 'Paid', key: 'paid', width: 12 },
        { header: 'Balance', key: 'bal', width: 12 }, { header: 'Status', key: 'st', width: 10 },
      ],
      rows: list.map((i) => ({ adm: i.student?.admissionNo, name: i.student ? `${i.student.firstName} ${i.student.lastName}` : '-', billed: i.amount, paid: i.paid, bal: i.amount - i.paid, st: i.status })),
    };
  },
};

const allowed = {
  attendance: ['dos', 'headteacher'],
  admissions: ['dos', 'headteacher'],
  financial: ['accountant', 'headteacher'],
};

router.get('/:type.:format', wrap(async (req, res) => {
  const { type, format } = req.params;
  if (!builders[type] || !['pdf', 'xlsx'].includes(format)) return res.status(404).json({ message: 'Unknown report' });
  if (req.user.role !== 'admin' && !allowed[type].includes(req.user.role)) return res.status(403).json({ message: 'Not allowed' });
  const rep = await builders[type](req);
  await audit(req, 'REPORT_EXPORT', 'Report', type, { format });

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    ws.addRow([`Groupe Scolaire APACOPE - ${rep.title}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.columns = rep.columns;
    const head = ws.addRow(rep.columns.map((c) => c.header));
    head.font = { bold: true };
    rep.rows.forEach((r) => ws.addRow(rep.columns.map((c) => r[c.key])));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);
  doc.pipe(res);
  doc.fontSize(15).text('Groupe Scolaire APACOPE', { align: 'center' });
  doc.fontSize(11).text(rep.title, { align: 'center' }).moveDown();
  const widths = rep.columns.map((c) => c.width);
  const scale = 510 / widths.reduce((a, b) => a + b, 0);
  const drawRow = (vals, bold) => {
    let x = 40;
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    vals.forEach((v, i) => { doc.text(String(v ?? ''), x, y, { width: widths[i] * scale - 4, lineBreak: false, ellipsis: true }); x += widths[i] * scale; });
    doc.moveDown(0.6);
    if (doc.y > 780) doc.addPage();
  };
  drawRow(rep.columns.map((c) => c.header), true);
  rep.rows.forEach((r) => drawRow(rep.columns.map((c) => r[c.key]), false));
  doc.end();
}));

module.exports = router;
