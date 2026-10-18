import { useState } from 'react';
import { download, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, today } from '../components/ui';

const REPORTS = [
  { type: 'attendance', title: 'Attendance report', desc: 'Per-student sessions, absences, lateness and attendance % for a date range.', roles: ['dos', 'headteacher'], range: true },
  { type: 'admissions', title: 'Admission list', desc: 'All admitted students with class, gender and status.', roles: ['dos', 'headteacher'] },
  { type: 'financial', title: 'Financial report', desc: 'Fees billed, paid and outstanding balances per student.', roles: ['accountant', 'headteacher'] },
];

export default function Reports() {
  const { user } = useAuth();
  const [from, setFrom] = useState(today().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const go = async (r, format) => {
    setBusy(r.type + format); setError('');
    try { await download(`/reports/${r.type}.${format}${r.range ? qs({ from, to }) : ''}`, `${r.type}-report.${format}`); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const list = REPORTS.filter((r) => user.role === 'admin' || r.roles.includes(user.role));
  return (
    <>
      <PageHeader title="Reports" subtitle="Export to PDF or Excel" />
      <Alert>{error}</Alert>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <div key={r.type} className="card flex flex-col">
            <h2>{r.title}</h2><p className="mt-1 text-sm text-ink-500">{r.desc}</p>
            {r.range && <div className="mt-3 grid grid-cols-2 gap-2"><div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>}
            <div className="mt-auto flex gap-2 pt-4">
              <button className="btn-primary flex-1" disabled={!!busy} onClick={() => go(r, 'pdf')}>{busy === r.type + 'pdf' ? '...' : 'PDF'}</button>
              <button className="btn-ghost flex-1" disabled={!!busy} onClick={() => go(r, 'xlsx')}>{busy === r.type + 'xlsx' ? '...' : 'Excel'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
