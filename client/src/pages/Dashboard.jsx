import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../components/Layout';
import { PageHeader, StatBand, Heatmap, StatusBadge, Spinner, Alert, Empty, useFetch, fmtMoney } from '../components/ui';

const NAVY = '#1f4166';
const GRID = '#dce1e8';
const MUTED = '#5b6a7c';

function Panel({ title, note, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-ink-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 px-5 py-4">
        <div className="flex items-baseline gap-2"><h2>{title}</h2>{note && <span className="text-[13px] text-ink-500">{note}</span>}</div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="text-ink-500">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value}% attendance</p>
    </div>
  );
}

function AttendanceDashboard({ d }) {
  const heat = useFetch(() => api.get('/attendance/heatmap'), []);
  const mon = useFetch(() => api.get('/attendance/monitoring'), []);
  const a = d.attendance;
  const tone = (v) => (v >= 90 ? 'good' : v >= 75 ? 'warn' : 'bad');
  return (
    <>
      <StatBand items={[
        { label: "Today's attendance", value: `${a.todayPct}%`, tone: tone(a.todayPct), hint: 'Present, late and excused' },
        { label: 'Monthly average', value: `${a.monthlyAvg}%`, tone: tone(a.monthlyAvg), hint: 'This month so far' },
        { label: 'Absent today', value: a.absentToday, tone: a.absentToday ? 'bad' : 'good', hint: 'Learners marked absent' },
        { label: 'Chronic absentees', value: a.chronicAbsentees, tone: a.chronicAbsentees ? 'bad' : 'good', hint: 'Above the monthly limit' },
      ]} />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Attendance, last 14 days" note="Dashed line is the 90% target">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.trend} margin={{ left: -14, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={{ stroke: GRID }} interval={2} />
                <YAxis domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine y={90} stroke={MUTED} strokeDasharray="4 4" />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: MUTED, strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="attendance" stroke={NAVY} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: NAVY }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Attendance by class and day" note="last 4 weeks">
          {heat.loading ? <Spinner /> : <Heatmap {...heat.data} />}
        </Panel>
      </div>

      <Panel className="mt-5" title="Absence monitoring" note="this month" action={<Link to="/monitoring" className="text-sm font-semibold text-brand-700 hover:underline">Open full view</Link>}>
        {mon.loading ? <Spinner /> : !mon.data?.length ? <Empty text="No absences have been recorded this month." /> : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead><tr><th className="th pl-5">Learner</th><th className="th">Absences</th><th className="th">Status</th><th className="th pr-5">Recommended action</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {mon.data.slice(0, 8).map((r) => (
                  <tr key={r.studentId}>
                    <td className="td pl-5"><span className="font-medium">{r.name}</span><span className="ml-2 text-xs text-ink-500">{r.className}</span></td>
                    <td className="td tabular-nums">{r.absences}</td>
                    <td className="td"><StatusBadge status={r.status} /></td>
                    <td className="td pr-5 text-ink-700">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function FamilyDashboard({ d }) {
  if (!d.children?.length) return <div className="card text-sm text-ink-500">No learner is linked to your account yet. Please contact the school office.</div>;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {d.children.map((c) => (
        <section key={c.id} className="rounded-lg border border-ink-200 bg-white">
          <header className="border-b border-ink-100 px-5 py-4"><h2>{c.name}</h2><p className="text-sm text-ink-500">{c.className}</p></header>
          <div className="p-5">
            <div className="flex items-baseline justify-between"><p className="text-sm text-ink-500">Attendance this month</p><p className="font-serif text-3xl font-semibold tabular-nums">{c.attendancePct}%</p></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`Attendance ${c.attendancePct}%`}><div className={`h-full rounded-full ${c.attendancePct >= 90 ? 'bg-emerald-600' : c.attendancePct >= 75 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${c.attendancePct}%` }} /></div>
            <dl className="mt-5 divide-y divide-ink-100 text-sm">
              <div className="flex justify-between py-2.5"><dt className="text-ink-500">Absences this month</dt><dd className="font-medium tabular-nums">{c.absences}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-ink-500">Fee balance</dt><dd className="font-medium tabular-nums">{fmtMoney(c.balance)}</dd></div>
            </dl>
            <div className="mt-4 flex gap-2"><Link className="btn-ghost flex-1" to="/results">Results</Link><Link className="btn-ghost flex-1" to="/my-attendance">Attendance</Link></div>
          </div>
        </section>
      ))}
    </div>
  );
}

function TrainerDashboard({ d }) {
  const classes = new Set((d.assignments || []).map((a) => a.class?._id)).size;
  return (
    <>
      <StatBand items={[
        { label: 'Assigned classes', value: classes },
        { label: 'Registers saved today', value: d.attendanceRecordedToday },
        { label: 'Materials uploaded', value: d.recentResources },
      ]} />
      <Panel className="mt-5" title="My classes and modules">
        {!d.assignments?.length ? <Empty text="No classes are assigned to you yet. Ask the DOS to assign them." /> : (
          <ul className="-my-2 divide-y divide-ink-100 text-sm">
            {d.assignments.map((a) => <li key={a._id} className="flex justify-between gap-4 py-3"><span className="font-medium">{a.class?.name}</span><span className="text-ink-500">{a.module?.name}</span></li>)}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/attendance" className="btn-primary">Take attendance</Link><Link to="/marks" className="btn-ghost">Enter marks</Link><Link to="/resources" className="btn-ghost">Upload material</Link></div>
      </Panel>
    </>
  );
}

function FinanceBand({ f }) {
  const pct = f.billed ? Math.round((f.collected / f.billed) * 100) : 0;
  return (
    <div className="mt-5 space-y-5">
      <StatBand items={[
        { label: 'Total billed', value: fmtMoney(f.billed) },
        { label: 'Collected', value: fmtMoney(f.collected), tone: 'good' },
        { label: 'Outstanding', value: fmtMoney(f.outstanding), tone: f.outstanding ? 'bad' : 'good' },
      ]} />
      <Panel title="Fee collection" note={`${pct}% of billed fees collected`}>
        <div className="flex h-8 gap-0.5 overflow-hidden rounded-md" role="img" aria-label={`Collected ${fmtMoney(f.collected)}, outstanding ${fmtMoney(f.outstanding)}`}>
          <div className="flex items-center bg-emerald-700 px-3 text-sm font-semibold text-white" style={{ width: `${pct}%`, minWidth: pct ? 56 : 0 }}>{pct > 8 && 'Collected'}</div>
          <div className="flex flex-1 items-center bg-brand-100 px-3 text-sm font-semibold text-brand-900">{pct < 92 && 'Outstanding'}</div>
        </div>
      </Panel>
    </div>
  );
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard() {
  const { user } = useAuth();
  const { data: d, loading, error } = useFetch(() => api.get('/dashboard'), []);
  if (loading) return <Spinner />;
  const staffAtt = d?.attendance;
  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.split(' ')[0]}`} subtitle={ROLE_LABEL[user.role]} />
      <Alert>{error}</Alert>
      {d && (
        <>
          {staffAtt && <AttendanceDashboard d={d} />}
          {staffAtt && d.counts && (
            <div className="mt-5">
              <StatBand items={[
                { label: 'Active learners', value: d.counts.students },
                { label: 'Trainers', value: d.counts.trainers },
                { label: 'Open follow-ups', value: d.openFollowUps, tone: d.openFollowUps ? 'warn' : 'good' },
                ...(d.pendingModeration !== undefined ? [{ label: 'Awaiting approval', value: d.pendingModeration, hint: 'Edutainment content' }] : []),
              ]} />
            </div>
          )}
          {d.role === 'trainer' && <TrainerDashboard d={d} />}
          {(d.role === 'student' || d.role === 'parent') && <FamilyDashboard d={d} />}
          {d.finance && <FinanceBand f={d.finance} />}
          {d.inventory && (
            <StatBand items={[
              { label: 'Inventory items', value: d.inventory.items },
              { label: 'Currently on loan', value: d.inventory.onLoan, tone: 'warn' },
              { label: 'Damaged', value: d.inventory.damaged, tone: d.inventory.damaged ? 'bad' : 'good' },
            ]} />
          )}
        </>
      )}
    </>
  );
}
