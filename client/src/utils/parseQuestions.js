/*
 * Turns pasted question text into questions the assignment form can edit.
 * No AI and no internet needed: it recognises the usual ways teachers write questions.
 *
 *   1. What does HTML stand for?          Q2) Which tag makes a link?
 *   A. Hyper Text Markup Language         a) <p>      b) <a>      c) <div>
 *   B. High Tech Modern Language          Answer: B     (or Ans: B, Correct: B, Key: B)
 *   C. Home Tool Markup Language          (2 marks)     (points are picked up too)
 *
 * Also understood:
 *   - the correct choice marked with * or a tick at its end, or the words (correct)
 *   - an answer key at the end:  "Answers: 1-B, 2-C, 3-A"  or one per line
 *   - choices written on one line
 *   - questions with no choices become written-answer questions
 */

const LETTERS = 'abcdefgh';
const START = /^\s*(?:question\s*|q\s*\.?\s*)?(\d{1,3})\s*[.):\-\]]\s*(?=\S)/i;
const KEY_HEAD = /^\s*(?:answer\s*key|answers|marking\s*scheme|memo|key)\s*[:\-]?\s*$|^\s*(?:answer\s*key|answers|marking\s*scheme)\s*[:\-]\s*\S/i;

const clean = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();

/** find "A." "b)" "(c)" markers in order a, b, c ... so "Mr. A. Smith" is not mistaken for a choice */
function findOptionMarkers(text) {
  const marks = [];
  const re = /(^|\s)\(?([A-Ha-h])[.)\]]\s+(?=\S)/g;
  let m;
  const all = [];
  while ((m = re.exec(text))) all.push({ at: m.index + m[1].length, letter: m[2].toLowerCase(), end: m.index + m[0].length });
  // keep the longest run that starts at "a" and goes a, b, c, ...
  for (let s = 0; s < all.length; s += 1) {
    if (all[s].letter !== 'a') continue;
    const run = [all[s]];
    for (let k = s + 1; k < all.length; k += 1) {
      if (all[k].letter === LETTERS[run.length]) run.push(all[k]);
    }
    if (run.length > marks.length) { marks.length = 0; marks.push(...run); }
  }
  return marks.length >= 2 ? marks : [];
}

const CORRECT_TAIL = /\s*(?:\*+|\u2713|\u2714|\u2705|\(\s*(?:correct|right|answer|ans)\s*\)|\[\s*(?:correct|right|answer|ans)\s*\])\s*$/i;
const CORRECT_HEAD = /^\s*(?:\*+|\u2713|\u2714)\s*/;

function parseBlock(raw) {
  let text = raw.replace(/\r/g, '');
  const warnings = [];

  // points: (2 marks) [3 pts] (1 mark)
  let points = 1;
  const pm = /[(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:marks?|pts?|points?|pt)\s*[)\]]/i.exec(text);
  if (pm) { points = Number(pm[1].replace(',', '.')) || 1; text = text.replace(pm[0], ' '); }

  // "Answer: B" line
  let answer = null;
  const am = /(?:^|\n|\s)(?:correct\s*answer|answer|ans|correct|key)\s*[:=\-]\s*\(?([^\n]+?)\)?\s*(?=\n|$)/i.exec(text);
  if (am) { answer = am[1].trim(); text = text.replace(am[0], '\n'); }

  const marks = findOptionMarkers(text);
  if (!marks.length) {
    return { text: clean(text), type: 'text', options: ['', ''], correct: 0, points, warnings };
  }

  const stem = clean(text.slice(0, marks[0].at));
  let correct = -1;
  const options = marks.map((mk, i) => {
    let o = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : text.length);
    o = clean(o);
    if (CORRECT_TAIL.test(o)) { o = o.replace(CORRECT_TAIL, '').trim(); correct = i; }
    if (CORRECT_HEAD.test(o)) { o = o.replace(CORRECT_HEAD, '').trim(); correct = i; }
    return o;
  });

  if (answer !== null && correct < 0) {
    const letter = /^\(?([A-Ha-h])\)?[.)]?$/.exec(answer.trim());
    if (letter) correct = LETTERS.indexOf(letter[1].toLowerCase());
    else {
      const byText = options.findIndex((o) => o.toLowerCase() === answer.trim().toLowerCase());
      if (byText >= 0) correct = byText;
    }
  }
  if (correct >= options.length) correct = -1;
  return { text: stem, type: 'choice', options, correct, points, warnings };
}

/** Parse pasted text. Returns { questions, notes } */
export function parseQuestions(input) {
  const notes = [];
  let text = String(input || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
  if (!text) return { questions: [], notes };

  // an answer key at the end
  const keyed = {};
  const lines = text.split('\n');
  const keyAt = lines.findIndex((l, i) => i > 0 && KEY_HEAD.test(l));
  if (keyAt > 0) {
    const keyText = lines.slice(keyAt).join('\n').replace(KEY_HEAD, (h) => h.replace(/^\s*(?:answer\s*key|answers|marking\s*scheme|memo|key)\s*[:\-]?/i, ''));
    const re = /(\d{1,3})\s*[.):\-=]*\s*\(?([A-Ha-h])\)?(?![A-Za-z])/g;
    let m;
    while ((m = re.exec(keyText))) keyed[Number(m[1])] = LETTERS.indexOf(m[2].toLowerCase());
    text = lines.slice(0, keyAt).join('\n').trim();
  }

  // split into one block per numbered question; with no numbers, split on blank lines
  const blocks = [];
  let cur = null;
  text.split('\n').forEach((line) => {
    const m = START.exec(line);
    const startsQuestion = m && !/^\s*[A-Ha-h][.)]/.test(line);
    if (startsQuestion) { cur = { no: Number(m[1]), lines: [line.replace(START, '')] }; blocks.push(cur); } else if (cur) cur.lines.push(line);
    else { cur = { no: null, lines: [line] }; blocks.push(cur); }
  });
  let parts = blocks;
  if (blocks.every((b) => b.no === null) || (blocks.length === 1 && blocks[0].no === null)) {
    parts = text.split(/\n\s*\n+/).filter((s) => s.trim()).map((s, i) => ({ no: i + 1, lines: [s] }));
  } else if (blocks[0].no === null && !blocks[0].lines.join('').trim()) parts = blocks.slice(1);

  const questions = parts.map((b, idx) => {
    const q = parseBlock(b.lines.join('\n'));
    const no = b.no ?? idx + 1;
    if (q.type === 'choice' && q.correct < 0 && keyed[no] !== undefined && keyed[no] < q.options.length) q.correct = keyed[no];
    return { ...q, no };
  }).filter((q) => q.text || q.options.some(Boolean));

  const unmarked = questions.filter((q) => q.type === 'choice' && q.correct < 0).length;
  if (unmarked) notes.push(`${unmarked} multiple choice question${unmarked === 1 ? ' has' : 's have'} no correct answer yet. Tick it below.`);
  return { questions, notes };
}