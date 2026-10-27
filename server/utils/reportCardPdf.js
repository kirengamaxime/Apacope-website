/* Draws one student report card page (A4) with pdfkit */
const fs = require('fs');
const school = require('../config/school');

const NAVY = '#0e2238';
const RED = '#c81e25';
const GREY = '#5b6a7c';
const LINE = '#d5dbe3';
const L = 40;      // left margin
const W = 515;     // content width

function header(doc) {
  const top = 36;
  if (fs.existsSync(school.logo)) doc.image(school.logo, L, top, { width: 58 });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(17).text(school.name, L + 72, top + 2, { width: W - 72 });
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  if (school.motto) doc.text(school.motto, L + 72, doc.y + 1, { width: W - 72 });
  const contact = [school.address, school.phone, school.email].filter(Boolean).join('   |   ');
  if (contact) doc.text(contact, L + 72, doc.y + 1, { width: W - 72 });
  const y = top + 66;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(2).strokeColor(RED).stroke();
  doc.y = y + 14;
}

function field(doc, label, value, x, y, w) {
  doc.font('Helvetica').fontSize(8).fillColor(GREY).text(label.toUpperCase(), x, y, { width: w, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(String(value ?? '-'), x, y + 11, { width: w, lineBreak: false, ellipsis: true });
}

function drawCard(doc, r, { comment } = {}) {
  header(doc);

  doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY).text('STUDENT REPORT CARD', L, doc.y, { width: W, align: 'center' });
  const termLine = r.term ? `${r.term.name}${r.term.year ? ` - ${r.term.year}` : ''}` : 'All recorded marks';
  doc.font('Helvetica').fontSize(10).fillColor(GREY).text(termLine, L, doc.y + 2, { width: W, align: 'center' });

  // learner details
  let y = doc.y + 14;
  doc.rect(L, y, W, 62).fillAndStroke('#f5f7fa', LINE);
  field(doc, 'Learner', `${r.student.firstName} ${r.student.lastName}`, L + 12, y + 9, 250);
  field(doc, 'Admission no', r.student.admissionNo, L + 270, y + 9, 110);
  field(doc, 'Gender', r.student.gender === 'F' ? 'Female' : r.student.gender === 'M' ? 'Male' : '-', L + 395, y + 9, 100);
  field(doc, 'Class', r.class?.name, L + 12, y + 36, 130);
  field(doc, 'Trade', r.class?.trade, L + 150, y + 36, 190);
  field(doc, 'Position', r.position ? `${r.position} of ${r.outOf}` : '-', L + 345, y + 36, 70);
  field(doc, 'Attendance', r.attendance ? `${r.attendance.percentage}%` : '-', L + 425, y + 36, 80);
  y += 78;

  // marks: one block per module, split into formative / summative / comprehensive
  const X = { mark: L + 255, pct: L + 335, grade: L + 385, result: L + 420 }; // column starts (title column is L + 14)
  const cell = (text, x, yy, w, o = {}) => doc.font(o.bold ? 'Helvetica-Bold' : o.italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(o.size || 9)
    .fillColor(o.color || NAVY).text(String(text ?? ''), x, yy, { width: w, align: o.align || 'left', lineBreak: false, ellipsis: true });
  const newPage = () => { doc.addPage(); header(doc); return doc.y; };

  doc.rect(L, y, W, 20).fill(NAVY);
  const head = (t, x, w, al) => doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(t, x, y + 6, { width: w, align: al || 'left', lineBreak: false });
  head('Module / assessment', L + 8, 240); head('Marks', X.mark, 75, 'right'); head('%', X.pct, 45, 'right'); head('Grade', X.grade, 35, 'center'); head('Result', X.result, 90, 'right');
  y += 20;

  if (!r.modules.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(GREY).text('No approved marks have been recorded for this learner in this period.', L + 5, y + 10, { width: W - 10 });
    y += 36;
  } else {
    r.modules.forEach((m) => {
      const firstCat = m.categories[0];
      if (y + 22 + 17 + 16 * Math.min(2, firstCat ? firstCat.items.length : 0) > 745) y = newPage();
      // module band
      doc.rect(L, y, W, 22).fill('#e3e9f1');
      cell(m.code ? `${m.module}  (${m.code})` : m.module, L + 8, y + 6, 245, { bold: true, size: 10 });
      cell(`${m.total} / ${m.max}`, X.mark, y + 6, 75, { bold: true, align: 'right' });
      cell(m.percentage, X.pct, y + 6, 45, { bold: true, align: 'right' });
      cell(m.grade, X.grade, y + 6, 35, { bold: true, align: 'center' });
      cell(m.competent ? 'Competent' : 'Not yet competent', X.result, y + 6, 90, { bold: true, align: 'right', color: m.competent ? '#146c43' : RED });
      y += 22;
      m.categories.forEach((c) => {
        if (y + 17 + 16 > 760) y = newPage();
        cell(c.label, L + 8, y + 4, 240, { bold: true, size: 8.5, color: GREY });
        cell(`${c.total} / ${c.max}`, X.mark, y + 4, 75, { bold: true, size: 8.5, align: 'right', color: GREY });
        cell(c.percentage, X.pct, y + 4, 45, { bold: true, size: 8.5, align: 'right', color: GREY });
        y += 17;
        c.items.forEach((it) => {
          if (y + 16 > 770) y = newPage();
          cell(it.title, L + 18, y + 3, 215);
          if (it.online) cell('Online', L + 195, y + 4, 52, { size: 7.5, color: RED, align: 'right' });
          cell(`${it.score} / ${it.maxScore}`, X.mark, y + 3, 75, { align: 'right' });
          cell(it.percentage, X.pct, y + 3, 45, { align: 'right' });
          doc.moveTo(L + 18, y + 16).lineTo(L + W, y + 16).lineWidth(0.4).strokeColor(LINE).stroke();
          y += 16;
        });
      });
      y += 8;
    });
  }

  // assessment summary: totals per category over all modules
  if (r.modules.length && r.typeTotals) {
    if (y > 690) y = newPage();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Assessment summary', L, y);
    y += 16;
    const cw = W / 3;
    r.typeTotals.forEach((t, i) => {
      const x = L + i * cw;
      doc.rect(x, y, cw - (i < 2 ? 6 : 0), 46).fillAndStroke('#f5f7fa', LINE);
      doc.font('Helvetica').fontSize(8).fillColor(GREY).text(t.label.toUpperCase(), x + 10, y + 7, { width: cw - 26, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY).text(t.max ? `${t.percentage}%` : '-', x + 10, y + 19, { width: cw - 26, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(GREY).text(t.max ? `${t.total} / ${t.max} marks - ${t.count} assessment${t.count === 1 ? '' : 's'}` : 'None recorded', x + 10, y + 34, { width: cw - 26, lineBreak: false });
    });
    y += 64;
  }

  // summary
  y += 4;
  if (y > 660) { doc.addPage(); header(doc); y = doc.y; }
  field(doc, 'Overall average', r.modules.length ? `${r.average}%` : '-', L, y, 110);
  field(doc, 'Grade', r.grade || '-', L + 130, y, 60);
  field(doc, 'Remark', r.remark || '-', L + 210, y, 140);
  field(doc, 'Modules competent', r.modules.length ? `${r.competentCount} of ${r.modules.length}` : '-', L + 370, y, 140);
  y += 40;

  // DOS comment
  const text = (comment ?? r.comment ?? '').trim() || r.suggestedComment || '';
  if (y > 640) { doc.addPage(); header(doc); y = doc.y; }
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Comment of the Director of Studies', L, y);
  y += 16;
  const h = Math.max(60, doc.heightOfString(text, { width: W - 20, font: 'Helvetica', size: 10 }) + 20);
  doc.rect(L, y, W, h).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.font('Helvetica').fontSize(10).fillColor(NAVY).text(text || ' ', L + 10, y + 10, { width: W - 20 });
  y += h + 36;

  // signatures
  if (y > 740) { doc.addPage(); header(doc); y = doc.y + 20; }
  ['Director of Studies', 'Head Teacher', 'Parent / Guardian'].forEach((label, i) => {
    const sx = L + i * 180;
    doc.moveTo(sx, y).lineTo(sx + 150, y).lineWidth(0.8).strokeColor(GREY).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(GREY).text(label, sx, y + 4, { width: 150 });
  });

  doc.font('Helvetica').fontSize(7.5).fillColor(GREY)
    .text('Grading: A 80-100 Excellent | B 70-79 Very good | C 60-69 Good | D 50-59 Competent | E below 50 Not yet competent', L, 776, { width: W, lineBreak: false })
    .text('A module is competent at 70% or more.', L, 787, { width: W, lineBreak: false });
}

module.exports = { drawCard };