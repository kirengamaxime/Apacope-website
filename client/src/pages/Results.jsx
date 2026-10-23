import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { PageHeader, Alert, Spinner, Empty, useFetch } from '../components/ui';

export default function Results() {
  const { user } = useAuth();
  const { t } = useLang();
  const students = useFetch(() => api.get('/students?limit=100'), []);
  const [studentId, setStudentId] = useState('');
  const list = students.data?.items || [];
  useEffect(() => { if (!studentId && list.length) setStudentId(list[0]._id); }, [list, studentId]);
  const res = useFetch(() => (studentId ? api.get(`/assessments/results/${studentId}`) : Promise.resolve(null)), [studentId]);
  const staff = !['student', 'parent'].includes(user.role);
  const canEdit = ['trainer', 'dos', 'admin'].includes(user.role);
  const [err, setErr] = useState('');
  const changeMark = async (i) => {
    const v = window.prompt(`New score for "${i.title}" (out of ${i.maxScore})`, i.score);
    if (v === null || v.trim() === '') return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > i.maxScore) return setErr(`Score must be between 0 and ${i.maxScore}`);
    setErr('');
    try { await api.put(`/assessments/${i.id}`, { score: n }); res.reload(); } catch (e) { setErr(e.message); }
  };
  const removeMark = async (i) => {
    if (!window.confirm(`Delete the mark "${i.title}" (${i.score}/${i.maxScore})?`)) return;
    setErr('');
    try { await api.del(`/assessments/${i.id}`); res.reload(); } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <PageHeader title={t('Results')} subtitle={t('Totals, averages, grades and competencies per module')}>
        {(staff || list.length > 1) && (
          <select className="input w-64" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {list.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
          </select>
        )}
      </PageHeader>
      <Alert>{err}</Alert>
      {res.loading || students.loading ? <Spinner /> : !res.data?.modules?.length ? <Empty text="No results have been entered yet." /> : (
        <>
          <div className="card mb-4 flex flex-wrap items-center gap-6">
            <div><p className="label">{t('Overall average')}</p><p className="text-3xl font-bold">{res.data.average}%</p></div>
            <div><p className="label">{t('Grade')}</p><p className="text-3xl font-bold text-brand-600">{res.data.grade}</p></div>
            <p className="text-sm text-ink-500">{t(res.data.remark)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {res.data.modules.map((m) => (
              <div key={m.code || m.module} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div><h2>{m.module}</h2><p className="text-xs text-ink-500">{m.code}</p></div>
                  <span className={`badge ${m.competent ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.competent ? t('Competent') : t('Not yet competent')}</span>
                </div>
                <ul className="my-3 divide-y divide-ink-100 text-sm">
                  {m.items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span className="capitalize">{i.title} <span className="text-ink-500">({t(i.type)})</span></span><span className="flex items-center gap-2">{i.score}/{i.maxScore}{canEdit && <><button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => changeMark(i)}>Edit</button><button className="btn-danger !px-2 !py-1 text-xs" onClick={() => removeMark(i)}>Delete</button></>}</span></li>)}
                </ul>
                <div className="flex justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm font-semibold"><span>{t('Total')} {m.total}/{m.max}</span><span>{m.percentage}% - {t('Grade')} {m.grade}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}