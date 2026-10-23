import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../api/client';
import { ROLE_LABEL } from '../components/Layout';
import { Alert, Spinner, Stat, useFetch, fmtDate } from '../components/ui';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Row({ label, children }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-500">{label}</dt><dd className="break-all text-right font-medium">{children || '-'}</dd></div>;
}

export default function StaffProfile() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => api.get(`/profiles/staff/${id}`), [id]);

  if (loading) return <Spinner />;
  if (error) return <><Alert>{error}</Alert><Link to="/users" className="btn-ghost mt-3"><ArrowLeft className="h-4 w-4" />Back to users</Link></>;
  const { user: u, assignments, timetable, classesLed, loans, activity, student, children, seesLog } = data;
  const teaches = u.role === 'trainer' || assignments.length > 0 || timetable.length > 0;
  const byDay = timetable.reduce((m, t) => { (m[t.day] ||= []).push(t); return m; }, {});
  const state = !u.active ? 'Disabled' : u.mustChangePassword ? 'Not yet logged in' : 'Active';

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/users" className="btn-ghost"><ArrowLeft className="h-4 w-4" />Back to users</Link>
        <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print profile</button>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xl font-semibold text-white">{initials(u.name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="leading-tight">{u.name}</h1>
          <p className="mt-1 text-sm text-ink-500">{ROLE_LABEL[u.role]}</p>
        </div>
        <span className={`badge ${!u.active ? 'bg-red-100 text-red-700' : u.mustChangePassword ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{state}</span>
      </div>

      {teaches && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Class modules" value={assignments.length} />
          <Stat label="Timetable slots" value={timetable.length} hint="per week" />
          <Stat label="Classes led" value={classesLed.length} hint="as class teacher" />
          <Stat label="Items on loan" value={loans.length} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2">Account details</h2>
          <dl className="divide-y divide-ink-100">
            <Row label="Email">{u.email}</Row>
            <Row label="Phone">{u.phone}</Row>
            <Row label="Role">{ROLE_LABEL[u.role]}</Row>
            <Row label="Last login">{u.lastLogin ? fmtDate(u.lastLogin) : 'Never'}</Row>
            <Row label="Account created">{fmtDate(u.createdAt)}</Row>
          </dl>
        </div>

        {(student || children.length > 0) && (
          <div className="card">
            <h2 className="mb-2">{student ? 'Learner record' : 'Children'}</h2>
            <ul className="divide-y divide-ink-100 text-sm">
              {(student ? [student] : children).map((c) => <li key={c._id} className="flex justify-between gap-3 py-2"><Link className="font-medium text-brand-700 hover:underline" to={`/students/${c._id}`}>{c.lastName} {c.firstName}</Link><span className="text-ink-500">{c.admissionNo}</span></li>)}
            </ul>
          </div>
        )}

        {teaches && (
          <div className="card lg:col-span-2">
            <h2 className="mb-3">Teaching assignments</h2>
            {!assignments.length ? <p className="text-sm text-ink-500">No class modules assigned yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead><tr><th className="th">Class</th><th className="th">Module</th></tr></thead>
                <tbody>{assignments.map((a) => <tr key={a._id} className="border-b border-ink-100"><td className="td font-medium">{a.class?.name}</td><td className="td">{a.module?.name} <span className="text-ink-500">{a.module?.code}</span></td></tr>)}</tbody></table></div>
            )}
            {classesLed.length > 0 && <p className="mt-3 text-sm text-ink-500">Class teacher of: <b className="text-ink-900">{classesLed.map((c) => c.name).join(', ')}</b></p>}
          </div>
        )}

        {teaches && (
          <div className="card lg:col-span-2">
            <h2 className="mb-3">Weekly timetable</h2>
            {!timetable.length ? <p className="text-sm text-ink-500">No timetable slots.</p> : (
              <ul className="divide-y divide-ink-100 text-sm">
                {Object.keys(byDay).sort().map((d) => (
                  <li key={d} className="grid gap-1 py-2 sm:grid-cols-[120px_1fr]"><span className="font-medium">{DAYS[d]}</span>
                    <span className="space-y-0.5">{byDay[d].map((t) => <span key={t._id} className="block">{t.startTime}-{t.endTime} - {t.module?.name} ({t.class?.name}){t.room ? `, ${t.room}` : ''}</span>)}</span></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loans.length > 0 && (
          <div className="card">
            <h2 className="mb-2">Items on loan</h2>
            <ul className="divide-y divide-ink-100 text-sm">{loans.map((l) => <li key={l._id} className="flex justify-between gap-3 py-2"><span className="font-medium">{l.item?.name} x{l.quantity}</span><span className="text-ink-500">since {fmtDate(l.borrowedAt)}</span></li>)}</ul>
          </div>
        )}

        {seesLog && (
          <div className="card lg:col-span-2 print:hidden">
            <h2 className="mb-2">Recent activity</h2>
            {!activity.length ? <p className="text-sm text-ink-500">No recorded activity.</p> : (
              <ul className="divide-y divide-ink-100 text-sm">{activity.map((x) => <li key={x._id} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="font-mono text-xs">{x.action}</span><span className="text-ink-500">{fmtDate(x.createdAt)}</span></li>)}</ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}