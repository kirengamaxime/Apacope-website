import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, useFetch, today, StatusBadge } from '../components/ui';

const STATUSES = [
  { key: 'present', label: 'Present', on: 'bg-emerald-600 text-white', off: 'text-emerald-700' },
  { key: 'absent', label: 'Absent', on: 'bg-red-600 text-white', off: 'text-red-700' },
  { key: 'late', label: 'Late', on: 'bg-amber-500 text-white', off: 'text-amber-700' },
  { key: 'excused', label: 'Excused', on: 'bg-sky-600 text-white', off: 'text-sky-700' },
];
const SESSIONS = ['Full day', 'Morning', 'Afternoon', 'Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'];

export default function Attendance() {
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const [classId, setClassId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [date, setDate] = useState(today());
  const [session, setSession] = useState('Full day');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [alerts, setAlerts] = useState([]);

  const classes = mine.data?.classes || [];
  const modules = useMemo(() => (mine.data?.assignments || []).filter((a) => a.class?._id === classId).map((a) => a.module).filter(Boolean), [mine.data, classId]);

  useEffect(() => { if (!classId && classes.length) setClassId(classes[0]._id); }, [classes, classId]);

  useEffect(() => {
    if (!classId) return;
    setLoading(true); setOk(''); setError(''); setAlerts([]);
    api.get(`/attendance/register${qs({ classId, date, session, moduleId })}`)
      .then(setRows).catch((e) => { setError(e.message); setRows([]); }).finally(() => setLoading(false));
  }, [classId, date, session, moduleId]);

  const set = (i, patch) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const counts = useMemo(() => STATUSES.reduce((o, s) => ({ ...o, [s.key]: rows.filter((r) => r.status === s.key).length }), {}), [rows]);
  const pct = rows.length ? Math.round(((rows.length - counts.absent) / rows.length) * 1000) / 10 : 0;

  const save = async () => {
    setBusy(true); setError(''); setOk('');
    try {
      const d = await api.post('/attendance/register', {
        classId, date, session, moduleId: moduleId || undefined,
        records: rows.map((r) => ({ student: r.student, status: r.status, note: r.note })),
      });
      setOk(`Register saved for ${d.saved} students.`);
      setAlerts(d.alerts || []);
      setRows((r) => r.map((x) => ({ ...x, recorded: true })));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Take attendance" subtitle="By class, subject, session or date" />
      <div className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="label">Class</label>
          <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setModuleId(''); }}>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Subject / module</label>
          <select className="input" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">General (whole day)</option>
            {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </div>
        <div><label className="label">Date</label><input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label">Session</label>
          <select className="input" value={session} onChange={(e) => setSession(e.target.value)}>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>

      <Alert>{error}</Alert><Alert kind="ok">{ok}</Alert>
      {alerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-amber-800">Automatic alerts triggered</p>
          <ul className="space-y-1">
            {alerts.map((a, i) => {
              const s = rows.find((r) => r.student === a.student);
              return <li key={i} className="flex flex-wrap items-center gap-2"><span className="font-medium">{s ? `${s.firstName} ${s.lastName}` : 'Student'}</span> {a.absences} absences this month <StatusBadge status={a.status} /> <span className="text-ink-700">- {a.action}</span></li>;
            })}
          </ul>
        </div>
      )}

      {loading ? <Spinner /> : !rows.length ? <Empty text="No students in this class (or you are not assigned to it)." /> : (
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="badge bg-ink-100 text-ink-700">Attendance {pct}%</span>
              {STATUSES.map((s) => <span key={s.key} className="badge bg-ink-100 text-ink-700">{s.label}: {counts[s.key]}</span>)}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setRows((r) => r.map((x) => ({ ...x, status: 'present' })))}>All present</button>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save register'}</button>
            </div>
          </div>
          <ul className="divide-y divide-ink-100">
            {rows.map((r, i) => (
              <li key={r.student} className="flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 md:w-1/3">
                  <p className="truncate text-sm font-medium">{i + 1}. {r.lastName} {r.firstName}</p>
                  <p className="text-xs text-ink-500">{r.admissionNo}{r.recorded ? ' - saved' : ''}</p>
                </div>
                <div className="grid grid-cols-4 gap-1 md:w-80">
                  {STATUSES.map((s) => (
                    <button key={s.key} type="button" onClick={() => set(i, { status: s.key })}
                      className={`rounded-md border px-1 py-1.5 text-xs font-medium ${r.status === s.key ? `${s.on} border-transparent` : `bg-white ${s.off} border-ink-200`}`}>{s.label}</button>
                  ))}
                </div>
                <input className="input md:w-48" placeholder="Note (optional)" value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
