import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, useFetch } from '../components/ui';
import { parseQuestions } from '../utils/parseQuestions';

let seq = 0;
const blankQ = () => ({ key: `n${seq++}`, text: '', type: 'text', options: ['', ''], correct: 0, points: 1 });
// empty choices are dropped, so the position of the correct one is worked out again
const shape = (list) => list.map((q) => {
  const kept = q.options.map((o, k) => ({ o: o.trim(), k })).filter((x) => x.o);
  return {
    ...(q._id ? { _id: q._id } : {}), text: q.text.trim(), type: q.type, points: Number(q.points),
    ...(q.type === 'choice' ? { options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.k === q.correct)) } : {}),
  };
});
/** what is still wrong with a question (empty text, fewer than two choices, no correct choice chosen) */
const problemOf = (q) => {
  if (!q.text.trim()) return 'Write the question.';
  if (q.type === 'choice') {
    if (q.options.filter((o) => o.trim()).length < 2) return 'Add at least two choices.';
    if (!(q.options[q.correct] || '').trim() || q.correct < 0) return 'Tick the correct choice.';
  }
  return '';
};

/** Write a new assignment, or change one that is not locked yet */
export default function AssignmentForm() {
  const { id } = useParams();
  const edit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const allModules = useFetch(() => api.get('/academic/modules'), []);
  const [f, setF] = useState({ title: '', instructions: '', classId: '', moduleId: '', termId: '', dueDate: '', type: 'formative' });
  const [questions, setQuestions] = useState([blankQ()]);
  const [startQs, setStartQs] = useState('');
  const [pasteOpen, setPasteOpen] = useState(!edit);
  const [pasteText, setPasteText] = useState('');
  const [pasteNote, setPasteNote] = useState('');
  const [roster, setRoster] = useState([]);
  const [picked, setPicked] = useState([]);
  const [loaded, setLoaded] = useState(!edit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const classes = mine.data?.classes || [];
  const modules = useMemo(() => {
    const a = mine.data?.assignments || [];
    if (a.length) return a.filter((x) => x.class?._id === f.classId).map((x) => x.module).filter(Boolean);
    const cls = classes.find((c) => c._id === f.classId);
    return (allModules.data || []).filter((m) => !cls || (m.trade?._id === cls.trade?._id && m.level === cls.level));
  }, [mine.data, f.classId, allModules.data, classes]);

  // editing: load what was written before
  useEffect(() => {
    if (!edit) return;
    api.get(`/online-assignments/${id}`).then(({ assignment: a }) => {
      setF({ title: a.title, instructions: a.instructions || '', classId: a.class?._id, moduleId: a.module?._id, termId: a.term?._id || '', dueDate: a.dueDate ? String(a.dueDate).slice(0, 10) : '', type: a.type || 'formative' });
      const qs0 = a.questions.map((q) => ({ key: q._id, _id: q._id, text: q.text, type: q.type, options: q.options?.length ? [...q.options] : ['', ''], correct: q.correct ?? 0, points: q.points }));
      setQuestions(qs0); setStartQs(JSON.stringify(shape(qs0)));
      setPicked(a.students.map((s) => s._id));
      setLoaded(true);
    }).catch((e) => { setError(e.message); setLoaded(true); });
  }, [id]);

  // new: start with the first class and the current term
  useEffect(() => { if (!edit && !f.classId && classes.length) setF((p) => ({ ...p, classId: classes[0]._id })); }, [classes, edit, f.classId]);
  useEffect(() => { if (!edit && f.classId) setF((p) => ({ ...p, moduleId: modules.find((m) => m._id === p.moduleId) ? p.moduleId : modules[0]?._id || '' })); }, [f.classId, modules.length]);
  useEffect(() => { if (edit || !terms.data?.length || f.termId) return; setF((p) => ({ ...p, termId: (terms.data.find((t) => t.current) || terms.data[0])._id })); }, [terms.data, edit, f.termId]);

  // the learners of the chosen class
  useEffect(() => {
    if (!f.classId) return;
    api.get(`/students${qs({ class: f.classId, status: 'active', limit: 100 })}`).then((d) => {
      setRoster(d.items || []);
      if (!edit) setPicked((d.items || []).map((s) => s._id));
    }).catch((e) => setError(e.message));
  }, [f.classId]);

  if (!['trainer', 'admin'].includes(user.role)) return <Navigate to="/assignments" replace />;
  if (!loaded) return <Spinner />;

  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setQ = (i, patch) => setQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i, k, v) => setQ(i, { options: questions[i].options.map((o, j) => (j === k ? v : o)) });
  const total = questions.reduce((t, q) => t + (Number(q.points) || 0), 0);
  const toggle = (sid) => setPicked(picked.includes(sid) ? picked.filter((x) => x !== sid) : [...picked, sid]);

  // read the pasted text and turn it into editable questions below
  const analyze = () => {
    const { questions: found, notes } = parseQuestions(pasteText);
    if (!found.length) return setPasteNote('No questions were found. Start each question with a number, for example "1." and put each choice on its own line as A. B. C. D.');
    const fresh = found.map((q) => ({ key: `n${seq++}`, text: q.text, type: q.type, options: q.type === 'choice' ? q.options : ['', ''], correct: q.correct, points: q.points }));
    const onlyBlank = questions.length === 1 && !questions[0].text.trim() && !questions[0]._id;
    setQuestions(onlyBlank ? fresh : [...questions, ...fresh]);
    setPasteNote(`${found.length} question${found.length === 1 ? '' : 's'} found (${found.filter((q) => q.type === 'choice').length} multiple choice). Check them below and change anything that is wrong. ${notes.join(' ')}`);
    setPasteText('');
  };

  const save = async (status) => {
    setError('');
    if (!f.title.trim()) return setError('Give the assignment a title.');
    if (!picked.length) return setError('Choose at least one learner.');
    const bad = questions.findIndex((q) => problemOf(q));
    if (bad >= 0) return setError(`Question ${bad + 1}: ${problemOf(questions[bad])}`);
    const q = shape(questions);
    setBusy(true);
    try {
      const body = { title: f.title, instructions: f.instructions, dueDate: f.dueDate, type: f.type, studentIds: picked, status };
      if (edit) {
        if (JSON.stringify(q) !== startQs) body.questions = q; // untouched questions are not re-sent
        await api.put(`/online-assignments/${id}`, body);
      } else {
        await api.post('/online-assignments', { ...body, classId: f.classId, moduleId: f.moduleId, termId: f.termId, questions: q });
      }
      navigate('/assignments');
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <>
      <PageHeader title={edit ? 'Edit assignment' : 'New assignment'} subtitle="Write the questions here. Learners answer them on the screen, so there is no file to upload or download." />
      <Alert>{error}</Alert>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="card space-y-3">
          <div><label className="label">Title</label><input className="input" value={f.title} onChange={up('title')} placeholder="Assignment 1: HTML forms" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">Class</label><select className="input" value={f.classId} disabled={edit} onChange={up('classId')}>{classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
            <div><label className="label">Module</label><select className="input" value={f.moduleId} disabled={edit} onChange={up('moduleId')}>{modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
            <div><label className="label">Term</label><select className="input" value={f.termId} disabled={edit} onChange={up('termId')}><option value="">-</option>{(terms.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label">Type of assessment</label><select className="input" value={f.type} onChange={up('type')}><option value="formative">Formative</option><option value="summative">Summative</option><option value="comprehensive">Comprehensive</option></select></div>
            <div><label className="label">Deadline (optional)</label><input type="date" className="input" value={f.dueDate} onChange={up('dueDate')} /></div>
          </div>
          <p className="text-xs text-ink-500">When the DOS approves the marks, they are entered in Results automatically as a {f.type} assessment. You do not type them again.</p>
          <div><label className="label">Instructions (optional)</label><textarea className="input min-h-[80px]" value={f.instructions} onChange={up('instructions')} placeholder="Read each question carefully and answer in your own words." /></div>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2>Learners who receive it <span className="text-sm font-normal text-ink-500">({picked.length} of {roster.length})</span></h2>
            <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => setPicked(roster.map((s) => s._id))}>Select all</button><button type="button" className="btn-ghost" onClick={() => setPicked([])}>Clear</button></div>
          </div>
          {!roster.length ? <p className="text-sm text-ink-500">This class has no active learners.</p> : (
            <ul className="grid max-h-64 gap-x-4 overflow-y-auto sm:grid-cols-2">
              {roster.map((s) => (
                <li key={s._id}><label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={picked.includes(s._id)} onChange={() => toggle(s._id)} />{s.lastName} {s.firstName} <span className="text-xs text-ink-500">{s.admissionNo}</span></label></li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <div><h2>Paste your questions</h2><p className="text-sm text-ink-500">Save time: paste questions you already typed (from Word, WhatsApp or a text file) and the system sets them up for you to check.</p></div>
              <button type="button" className="btn-ghost" onClick={() => setPasteOpen(!pasteOpen)}>{pasteOpen ? 'Hide' : 'Paste questions'}</button>
            </div>
            {pasteOpen && (
              <div className="mt-3 space-y-2">
                <textarea className="input min-h-[180px] font-mono text-sm" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'1. What does HTML stand for?\nA. Hyper Text Markup Language\nB. High Tech Modern Language\nC. Home Tool Markup Language\nAnswer: A\n\n2. Explain the box model. (5 marks)\n\nYou can also put the answers at the end:  Answers: 1-A, 3-C'} />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-primary" disabled={!pasteText.trim()} onClick={analyze}>Analyze and add the questions</button>
                  <p className="text-xs text-ink-500">Start each question with a number. Put choices as A. B. C. D. Give the correct one as "Answer: B", or mark it with * at the end.</p>
                </div>
              </div>
            )}
            {pasteNote && <p className="mt-3 rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-900">{pasteNote}</p>}
          </div>
          <div className="flex items-baseline justify-between"><h2>Questions</h2><span className="text-sm text-ink-500">Total: <b className="text-ink-900">{total} points</b></span></div>
          {questions.map((q, i) => (
            <div key={q.key} className={`card space-y-3 ${pasteNote && problemOf(q) && q.text.trim() ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Question {i + 1}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-44 py-1.5" value={q.type} onChange={(e) => setQ(i, { type: e.target.value })}><option value="text">Written answer</option><option value="choice">Multiple choice</option></select>
                  <label className="flex items-center gap-1.5 text-sm text-ink-500">Points <input type="number" min={0.5} step={0.5} className="input w-20 py-1.5" value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} /></label>
                  {questions.length > 1 && <button type="button" className="btn-danger" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>Remove</button>}
                </div>
              </div>
              <textarea className="input min-h-[70px]" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Type the question here" />
              {pasteNote && q.text.trim() && problemOf(q) && <p className="text-sm font-medium text-amber-700">{problemOf(q)}</p>}
              {q.type === 'choice' && (
                <div className="space-y-2">
                  <p className="text-xs text-ink-500">Tick the circle beside the correct choice. These questions are marked automatically.</p>
                  {q.options.map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <input type="radio" name={`c-${q.key}`} checked={q.correct === k} onChange={() => setQ(i, { correct: k })} aria-label={`Choice ${k + 1} is correct`} />
                      <input className="input flex-1 py-1.5" value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Choice ${k + 1}`} />
                      {q.options.length > 2 && <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== k), correct: q.correct === k ? 0 : q.correct > k ? q.correct - 1 : q.correct })}>Remove</button>}
                    </div>
                  ))}
                  {q.options.length < 6 && <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setQ(i, { options: [...q.options, ''] })}>+ Add a choice</button>}
                </div>
              )}
            </div>
          ))}
          <button type="button" className="btn-ghost w-full" onClick={() => setQuestions([...questions, blankQ()])}>+ Add a question</button>
        </div>

        <div className="flex flex-wrap gap-2 pb-6">
          <button className="btn-primary" disabled={busy} onClick={() => save('published')}>{edit ? 'Save and publish' : 'Publish to learners'}</button>
          <button className="btn-ghost" disabled={busy} onClick={() => save('draft')}>Save as draft (learners cannot see it)</button>
          <button className="btn-ghost" disabled={busy} onClick={() => navigate('/assignments')}>Cancel</button>
        </div>
      </div>
    </>
  );
}