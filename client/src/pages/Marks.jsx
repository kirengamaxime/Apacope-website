import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, useFetch } from '../components/ui';

export default function Marks() {
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

  const save = async () => {
    setError(''); setMsg('');
    const marks = Object.entries(scores).filter(([, v]) => v !== '').map(([student, v]) => ({ student, score: Number(v) }));
    if (!marks.length) return setError('Enter at least one score');
    try {
      await api.post('/assessments/bulk', { classId, moduleId, termId, type, title, maxScore: Number(maxScore), marks });
      setMsg(`Saved ${marks.length} marks.`); setScores({}); loadSheet();
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
      <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
      {loading ? <Spinner /> : !sheet.length ? <Empty text="No students found for this selection." /> : (
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><h2>Mark sheet</h2><button className="btn-primary" onClick={save}>Save new marks</button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr className="border-b border-ink-200"><th className="th">Student</th><th className="th">New score (/{maxScore})</th><th className="th">Total so far</th><th className="th">%</th><th className="th">Grade</th><th className="th">Competency</th></tr></thead>
              <tbody>
                {sheet.map((r) => (
                  <tr key={r.student} className="border-b border-ink-100">
                    <td className="td font-medium">{r.name}<span className="block text-xs font-normal text-ink-500">{r.admissionNo}</span></td>
                    <td className="td"><input type="number" min={0} max={maxScore} className="input w-24" value={scores[r.student] ?? ''} onChange={(e) => setScores({ ...scores, [r.student]: e.target.value })} /></td>
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
