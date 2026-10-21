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

  // marks table
  const cols = [{ h: 'Module', w: 195 }, { h: 'Code', w: 70 }, { h: 'Marks', w: 70, a: 'right' }, { h: '%', w: 45, a: 'right' }, { h: 'Grade', w: 40, a: 'center' }, { h: 'Result', w: 95, a: 'center' }];
  const row = (vals, yy, o = {}) => {
    let x = L;
    cols.forEach((c, i) => {
      doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(o.color && o.color[i] ? o.color[i] : NAVY)
        .text(String(vals[i] ?? ''), x + 5, yy + 5, { width: c.w - 10, align: c.a || 'left', lineBreak: false, ellipsis: true });
      x += c.w;
    });
  };
  doc.rect(L, y, W, 20).fill(NAVY);
  let x0 = L;
  cols.forEach((c) => { doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(c.h, x0 + 5, y + 6, { width: c.w - 10, align: c.a || 'left', lineBreak: false }); x0 += c.w; });
  y += 20;

  if (!r.modules.length) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(GREY).text('No marks have been recorded for this learner yet.', L + 5, y + 10, { width: W - 10 });
    y += 36;
  } else {
    r.modules.forEach((m, i) => {
      if (y > 640) { doc.addPage(); header(doc); y = doc.y; }
      if (i % 2) doc.rect(L, y, W, 20).fill('#f5f7fa');
      row([m.module, m.code, `${m.total} / ${m.max}`, `${m.percentage}`, m.grade, m.competent ? 'Competent' : 'Not yet competent'], y, { color: { 5: m.competent ? '#146c43' : RED } });
      y += 20;
    });
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.8).strokeColor(LINE).stroke();
  }

  // summary
  y += 12;
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