import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, useFetch } from '../components/ui';
import { StatusPill } from './MarksReview';

export default function Marks() {
  const { user } = useAuth();
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const allModules = useFetch(() => api.get('/academic/modules'), []);
  const [classId, setClassId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [termId, setTermId] = useState('');
  const [type, setType] = useState('formative');
  const [title, setTitle] = useState('Quiz 1');
  const [maxScore, setMaxScore] = useState(20);
  const [scores, setScores] = useState({});
  const [sheet, setSheet] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [wf, setWf] = useState({ status: 'draft' }); // submission workflow status
  const [sending, setSending] = useState(false);

  const classes = mine.data?.classes || [];
  const modules = useMemo(() => {
    const a = mine.data?.assignments || [];
    if (a.length) return a.filter((x) => x.class?._id === classId).map((x) => x.module).filter(Boolean);
    const cls = classes.find((c) => c._id === classId);
    return (allModules.data || []).filter((m) => !cls || (m.trade?._id === cls.trade?._id && m.level === cls.level));
  }, [mine.data, classId, allModules.data, classes]);

  useEffect(() => { if (!classId && classes.length) setClassId(classes[0]._id); }, [classes, classId]);
  useEffect(() => { if (!terms.data?.length || termId) return; setTermId((terms.data.find((t) => t.current) || terms.data[0])._id); }, [terms.data, termId]);
  useEffect(() => { setModuleId(modules[0]?._id || ''); }, [classId, modules.length]);

  const loadSheet = () => {
    if (!classId || !moduleId) return;
    setLoading(true);
    api.get(`/assessments/marksheet${qs({ classId, moduleId, termId })}`).then(setSheet).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(loadSheet, [classId, moduleId, termId]);

  const loadStatus = () => {
    if (!classId || !moduleId) return;
    api.get(`/mark-submissions/status${qs({ classId, moduleId, termId })}`).then(setWf).catch(() => setWf({ status: 'draft' }));
  };
  useEffect(loadStatus, [classId, moduleId, termId]);

  // a trainer cannot change marks once they are submitted or approved; the DOS can
  const locked = user.role === 'trainer' && ['submitted', 'approved'].includes(wf.status);
  const hasMarks = sheet.some((r) => r.max > 0);
  const canSubmit = ['draft', 'returned'].includes(wf.status) && hasMarks;

  const submitToDos = async () => {
    if (!window.confirm('Submit these marks to the DOS?\n\nAfter you submit you cannot change them unless the DOS sends them back to you.')) return;
    setError(''); setMsg(''); setSending(true);
    try { await api.post('/mark-submissions/submit', { classId, moduleId, termId }); setMsg('Marks submitted to the DOS.'); loadStatus(); }
    catch (e) { setError(e.message); } finally { setSending(false); }
  };

  const save = async () => {
    setError(''); setMsg('');
    if (locked) return setError('These marks are locked. Ask the DOS to return them if you need to change something.');
    const marks = Object.entries(scores).filter(([, v]) => v !== '').map(([student, v]) => ({ student, score: Number(v) }));
    if (!marks.length) return setError('Enter at least one score');
    try {
      await api.post('/assessments/bulk', { classId, moduleId, termId, type, title, maxScore: Number(maxScore), marks });
      setMsg(`Saved ${marks.length} marks.`); setScores({}); loadSheet(); loadStatus();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <PageHeader title="Marks and assessment" subtitle="Formative, summative and comprehensive results with automatic totals, grades and competency" />
      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label">Class</label><select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className="label">Module</label><select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>{modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
        <div><label className="label">Term</label><select className="input" value={termId} onChange={(e) => setTermId(e.target.value)}>{(terms.data || []).map((t) => <option key={t._id} value={t._id}>{t.name} - {t.academicYear?.name}</option>)}</select></div>
        <div><label className="label">Assessment type</label><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{['formative', 'summative', 'comprehensive'].map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">Maximum score</label><input type="number" min={1} className="input" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} /></div>
      </div>
      {classes.length === 0 && !mine.loading && user.role === 'trainer' && <Alert>You have no classes yet. Ask the DOS to assign you to your classes and modules under Academic setup, Trainer Assignments.</Alert>}
      {hasMarks && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-center gap-2"><span className="font-medium">Status of these marks:</span><StatusPill status={wf.status} /></p>
            {wf.status === 'returned' && wf.reviewComment && <p className="mt-1.5 text-brand-700">DOS note: {wf.reviewComment}</p>}
            {wf.status === 'submitted' && <p className="mt-1 text-ink-500">Waiting for the DOS to review. The marks are locked meanwhile.</p>}
            {wf.status === 'approved' && <p className="mt-1 text-ink-500">Approved{wf.reviewedBy ? ` by ${wf.reviewedBy}` : ''}. Learners and parents can now see them.</p>}
            {['draft', 'returned'].includes(wf.status) && <p className="mt-1 text-ink-500">Learners and parents cannot see these marks until the DOS approves them.</p>}
          </div>
          {canSubmit && <button className="btn-primary" disabled={sending} onClick={submitToDos}>{wf.status === 'returned' ? 'Resubmit to DOS' : 'Submit to DOS'}</button>}
        </div>
      )}
      <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
      {loading ? <Spinner /> : !sheet.length ? <Empty text="No students found for this selection." /> : (
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2>Mark sheet</h2><button className="btn-primary" disabled={locked} onClick={save}>Save new marks</button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr className="border-b border-ink-200"><th className="th">Student</th><th className="th">New score (/{maxScore})</th><th className="th">Total so far</th><th className="th">%</th><th className="th">Grade</th><th className="th">Competency</th></tr></thead>
              <tbody>
                {sheet.map((r) => (
                  <tr key={r.student} className="border-b border-ink-100">
                    <td className="td font-medium">{r.name}<span className="block text-xs font-normal text-ink-500">{r.admissionNo}</span></td>
                    <td className="td"><input type="number" min={0} max={maxScore} disabled={locked} className="input w-24" value={scores[r.student] ?? ''} onChange={(e) => setScores({ ...scores, [r.student]: e.target.value })} /></td>
                    <td className="td">{r.total}/{r.max}</td><td className="td">{r.percentage}%</td><td className="td font-semibold">{r.max ? r.grade : '-'}</td>
                    <td className="td">{r.max ? <span className={`badge ${r.percentage >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.percentage >= 70 ? 'Competent' : 'Not yet competent'}</span> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}