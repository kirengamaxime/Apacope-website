import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, useFetch } from '../components/ui';

let seq = 0;
const blankQ = () => ({ key: `n${seq++}`, text: '', type: 'text', options: ['', ''], correct: 0, points: 1 });
const shape = (list) => list.map((q) => ({ ...(q._id ? { _id: q._id } : {}), text: q.text.trim(), type: q.type, points: Number(q.points), ...(q.type === 'choice' ? { options: q.options.map((o) => o.trim()).filter(Boolean), correct: q.correct } : {}) }));

/** Write a new assignment, or change one that is not locked yet */
export default function AssignmentForm() {
  const { id } = useParams();
  const edit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const allModules = useFetch(() => api.get('/academic/modules'), []);
  const [f, setF] = useState({ title: '', instructions: '', classId: '', moduleId: '', termId: '', dueDate: '' });
  const [questions, setQuestions] = useState([blankQ()]);
  const [startQs, setStartQs] = useState('');
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
      setF({ title: a.title, instructions: a.instructions || '', classId: a.class?._id, moduleId: a.module?._id, termId: a.term?._id || '', dueDate: a.dueDate ? String(a.dueDate).slice(0, 10) : '' });
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

  const save = async (status) => {
    setError('');
    if (!f.title.trim()) return setError('Give the assignment a title.');
    if (!picked.length) return setError('Choose at least one learner.');
    const q = shape(questions);
    setBusy(true);
    try {
      const body = { title: f.title, instructions: f.instructions, dueDate: f.dueDate, studentIds: picked, status };
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
          <div className="grid gap-3 sm:grid-cols-3"><div><label className="label">Deadline (optional)</label><input type="date" className="input" value={f.dueDate} onChange={up('dueDate')} /></div></div>
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
          <div className="flex items-baseline justify-between"><h2>Questions</h2><span className="text-sm text-ink-500">Total: <b className="text-ink-900">{total} points</b></span></div>
          {questions.map((q, i) => (
            <div key={q.key} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Question {i + 1}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-44 py-1.5" value={q.type} onChange={(e) => setQ(i, { type: e.target.value })}><option value="text">Written answer</option><option value="choice">Multiple choice</option></select>
                  <label className="flex items-center gap-1.5 text-sm text-ink-500">Points <input type="number" min={0.5} step={0.5} className="input w-20 py-1.5" value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} /></label>
                  {questions.length > 1 && <button type="button" className="btn-danger" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>Remove</button>}
                </div>
              </div>
              <textarea className="input min-h-[70px]" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Type the question here" />
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