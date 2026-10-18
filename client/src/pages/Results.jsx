import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, Empty, useFetch } from '../components/ui';

export default function Results() {
  const { user } = useAuth();
  const students = useFetch(() => api.get('/students?limit=100'), []);
  const [studentId, setStudentId] = useState('');
  const list = students.data?.items || [];
  useEffect(() => { if (!studentId && list.length) setStudentId(list[0]._id); }, [list, studentId]);
  const res = useFetch(() => (studentId ? api.get(`/assessments/results/${studentId}`) : Promise.resolve(null)), [studentId]);
  const staff = !['student', 'parent'].includes(user.role);

  return (
    <>
      <PageHeader title="Results" subtitle="Totals, averages, grades and competencies per module">
        {(staff || list.length > 1) && (
          <select className="input w-64" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {list.map((s) => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
          </select>
        )}
      </PageHeader>
      {res.loading || students.loading ? <Spinner /> : !res.data?.modules?.length ? <Empty text="No results have been entered yet." /> : (
        <>
          <div className="card mb-4 flex flex-wrap items-center gap-6">
            <div><p className="label">Overall average</p><p className="text-3xl font-bold">{res.data.average}%</p></div>
            <div><p className="label">Grade</p><p className="text-3xl font-bold text-brand-600">{res.data.grade}</p></div>
            <p className="text-sm text-ink-500">{res.data.remark}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {res.data.modules.map((m) => (
              <div key={m.code || m.module} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div><h2>{m.module}</h2><p className="text-xs text-ink-500">{m.code}</p></div>
                  <span className={`badge ${m.competent ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.competent ? 'Competent' : 'Not yet competent'}</span>
                </div>
                <ul className="my-3 divide-y divide-ink-100 text-sm">
                  {m.items.map((i) => <li key={i.id} className="flex justify-between py-1.5"><span className="capitalize">{i.title} <span className="text-ink-500">({i.type})</span></span><span>{i.score}/{i.maxScore}</span></li>)}
                </ul>
                <div className="flex justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm font-semibold"><span>Total {m.total}/{m.max}</span><span>{m.percentage}% - Grade {m.grade}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
