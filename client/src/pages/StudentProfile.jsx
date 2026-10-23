import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Alert, Spinner, Stat, StatusBadge, useFetch, fmtDate, fmtMoney } from '../components/ui';

const initials = (s) => `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase();
const ageOf = (dob) => {
  if (!dob) return '';
  const d = new Date(dob); const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
  return a >= 0 ? `${a} years` : '';
};

function Row({ label, children }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-500">{label}</dt><dd className="text-right font-medium">{children || '-'}</dd></div>;
}

export default function StudentProfile() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const { data, loading, error } = useFetch(() => api.get(`/profiles/student/${id}`), [id]);
  const staff = hasRole('dos', 'headteacher');

  if (loading) return <Spinner />;
  if (error) return <><Alert>{error}</Alert><Link to="/students" className="btn-ghost mt-3"><ArrowLeft className="h-4 w-4" />Back to students</Link></>;
  const { student: s, attendance: a, results: r, finance: f } = data;
  const attTone = a.total === 0 ? 'default' : a.rate >= 90 ? 'good' : a.rate >= 75 ? 'warn' : 'bad';

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/students" className="btn-ghost"><ArrowLeft className="h-4 w-4" />Back to students</Link>
        <div className="flex gap-2">
          {staff && <Link to="/report-cards" className="btn-ghost">Report cards</Link>}
          <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print profile</button>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xl font-semibold text-white">{initials(s)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="leading-tight">{s.lastName} {s.firstName}</h1>
          <p className="mt-1 text-sm text-ink-500">Admission no. {s.admissionNo} - {s.class?.name || 'No class'}{s.class?.trade?.name ? ` (${s.class.trade.name})` : ''}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Attendance" value={a.total ? `${a.rate}%` : '-'} tone={attTone} hint={`${a.absent} absent of ${a.total} recorded`} />
        <Stat label="Average mark" value={r.hasMarks ? `${r.average}%` : '-'} hint={r.hasMarks ? `Grade ${r.grade} - ${r.remark}` : 'No marks yet'} tone={r.hasMarks ? (r.average >= 70 ? 'good' : r.average >= 50 ? 'warn' : 'bad') : 'default'} />
        {f ? <Stat label="Fees balance" value={fmtMoney(f.balance)} tone={f.balance > 0 ? 'bad' : 'good'} hint={`Paid ${fmtMoney(f.paid)} of ${fmtMoney(f.billed)}`} /> : <Stat label="Modules marked" value={r.modules.length} />}
        <Stat label="Modules marked" value={r.modules.length} hint={`${r.modules.filter((m) => m.competent).length} competent`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2">Personal details</h2>
          <dl className="divide-y divide-ink-100">
            <Row label="Admission number">{s.admissionNo}</Row>
            <Row label="Gender">{s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : ''}</Row>
            <Row label="Date of birth">{s.dob ? `${fmtDate(s.dob)} (${ageOf(s.dob)})` : ''}</Row>
            <Row label="Class">{s.class?.name}</Row>
            <Row label="Trade">{s.class?.trade?.name}</Row>
            <Row label="Portal login">{s.user ? s.user.email : 'No login account'}</Row>
            <Row label="Admitted">{fmtDate(s.createdAt)}</Row>
          </dl>
        </div>

        <div className="card">
          <h2 className="mb-2">Parents and guardians</h2>
          {!s.parents?.length ? <p className="text-sm text-ink-500">No parent is linked yet.{staff && ' Use "Link parent" on the Students page.'}</p> : (
            <ul className="divide-y divide-ink-100">
              {s.parents.map((p) => (
                <li key={p._id} className="py-2.5 text-sm">
                  <p className="font-medium">{p.user?.name} <span className="font-normal text-ink-500">{p.relationship ? `(${p.relationship})` : ''}</span></p>
                  <p className="text-ink-500">{[p.user?.phone, p.user?.email].filter(Boolean).join(' - ') || 'No contact details'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-3">Academic results</h2>
          {!r.hasMarks ? <p className="text-sm text-ink-500">No marks have been recorded yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead><tr><th className="th">Module</th><th className="th">Marks</th><th className="th">%</th><th className="th">Grade</th><th className="th">Competency</th></tr></thead>
                <tbody>
                  {r.modules.map((m) => (
                    <tr key={m.code || m.module} className="border-b border-ink-100">
                      <td className="td font-medium">{m.module}<span className="block text-xs font-normal text-ink-500">{m.code}</span></td>
                      <td className="td whitespace-nowrap">{m.total}/{m.max}</td><td className="td">{m.percentage}%</td><td className="td font-semibold">{m.grade}</td>
                      <td className="td"><span className={`badge ${m.competent ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.competent ? 'Competent' : 'Not yet competent'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-2">Attendance</h2>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center text-sm">
            {[['Present', a.present], ['Absent', a.absent], ['Late', a.late], ['Excused', a.excused]].map(([k, v]) => <div key={k} className="rounded-md bg-ink-50 py-2"><p className="text-lg font-semibold tabular-nums">{v}</p><p className="text-xs text-ink-500">{k}</p></div>)}
          </div>
          <h3 className="mb-1 text-sm">Recent absences</h3>
          {!a.recentAbsences.length ? <p className="text-sm text-ink-500">No absences recorded.</p> : (
            <ul className="divide-y divide-ink-100 text-sm">{a.recentAbsences.map((x) => <li key={x._id} className="flex justify-between py-1.5"><span>{fmtDate(x.date)} - {x.session}</span><span className="text-ink-500">{x.note}</span></li>)}</ul>
          )}
        </div>

        {f && (
          <div className="card">
            <h2 className="mb-2">Fees</h2>
            {!f.invoices.length ? <p className="text-sm text-ink-500">No invoices for this learner.</p> : (
              <ul className="divide-y divide-ink-100 text-sm">
                {f.invoices.map((i) => <li key={i._id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-medium">{i.description || 'Invoice'}</span><span>{fmtMoney(i.paid)} / {fmtMoney(i.amount)}</span><StatusBadge status={i.status} /></li>)}
              </ul>
            )}
            {f.payments.length > 0 && <>
              <h3 className="mb-1 mt-4 text-sm">Recent receipts</h3>
              <ul className="divide-y divide-ink-100 text-sm">{f.payments.map((p) => <li key={p._id} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="font-medium">{p.receiptNo}</span><span>{fmtMoney(p.amount)}</span><span className="text-ink-500">{fmtDate(p.createdAt)}</span></li>)}</ul>
            </>}
          </div>
        )}
      </div>
    </>
  );
}