import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatusBadge, Spinner, Alert, Modal, useFetch, fmtDate, today } from '../components/ui';

function FollowUpForm({ student, onDone, onClose }) {
  const [f, setF] = useState({ parentContacted: '', method: 'phone', contactDate: today(), discussion: '', agreedAction: '' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/attendance/followups', { ...f, student: student.studentId }); onDone(); } catch (er) { setError(er.message); }
  };
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={`Follow-up: ${student.name}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Parent / guardian contacted</label><input className="input" required value={f.parentContacted} onChange={up('parentContacted')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Method</label><select className="input" value={f.method} onChange={up('method')}>{['phone', 'sms', 'email', 'visit', 'meeting'].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="label">Date</label><input type="date" className="input" value={f.contactDate} onChange={up('contactDate')} /></div>
        </div>
        <div><label className="label">What was discussed</label><textarea className="input" rows={2} value={f.discussion} onChange={up('discussion')} /></div>
        <div><label className="label">Agreed action</label><textarea className="input" rows={2} required value={f.agreedAction} onChange={up('agreedAction')} /></div>
        <button className="btn-primary w-full">Save follow-up</button>
      </form>
    </Modal>
  );
}

function Rules({ canEdit }) {
  const { data, loading, reload } = useFetch(() => api.get('/attendance/rules'), []);
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');
  if (loading) return <Spinner />;
  const rules = draft || data;
  const setT = (i, k, v) => setDraft({ ...rules, thresholds: rules.thresholds.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)) });
  const save = async () => {
    await api.put('/attendance/rules', rules); setDraft(null); setMsg('Rules saved.'); reload();
  };
  return (
    <div className="card">
      <h2 className="mb-1">Configurable rules</h2>
      <p className="mb-3 text-sm text-ink-500">Set how many absences in a month trigger each status and action.</p>
      <Alert kind="ok">{msg}</Alert>
      <div className="space-y-2">
        {[...rules.thresholds].sort((a, b) => a.minAbsences - b.minAbsences).map((t, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[110px_160px_1fr]">
            <div className="flex items-center gap-2"><input type="number" min={0} disabled={!canEdit} className="input w-20" value={t.minAbsences} onChange={(e) => setT(i, 'minAbsences', e.target.value)} /><span className="text-sm text-ink-500">absences</span></div>
            <StatusBadge status={t.status} />
            <input className="input" disabled={!canEdit} value={t.action} onChange={(e) => setT(i, 'action', e.target.value)} />
          </div>
        ))}
      </div>
      {canEdit && <button className="btn-primary mt-4" onClick={save}>Save rules</button>}
    </div>
  );
}

export default function Monitoring() {
  const { hasRole } = useAuth();
  const canManage = hasRole('dos', 'headteacher');
  const mon = useFetch(() => api.get('/attendance/monitoring'), []);
  const fu = useFetch(() => api.get('/attendance/followups'), []);
  const [target, setTarget] = useState(null);

  return (
    <>
      <PageHeader title="Absence monitoring" subtitle="Students flagged automatically from this month's absences" />
      <div className="card mb-4">
        {mon.loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr className="border-b border-ink-200"><th className="th">Student</th><th className="th">Class</th><th className="th">Absences this month</th><th className="th">System Status</th><th className="th">Recommended Action</th><th className="th" /></tr></thead>
              <tbody>
                {(mon.data || []).map((r) => (
                  <tr key={r.studentId} className="border-b border-ink-100">
                    <td className="td font-medium">{r.name}</td><td className="td">{r.className}</td><td className="td">{r.absences}</td>
                    <td className="td"><StatusBadge status={r.status} /></td><td className="td">{r.action}</td>
                    <td className="td text-right"><button className="btn-ghost" onClick={() => setTarget(r)}>Log contact</button></td>
                  </tr>
                ))}
                {!mon.data?.length && <tr><td className="td text-ink-500" colSpan={6}>No absences recorded this month.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Rules canEdit={canManage} />
        <div className="card">
          <h2 className="mb-3">Follow-up register</h2>
          {fu.loading ? <Spinner /> : (
            <ul className="divide-y divide-ink-100 text-sm">
              {(fu.data || []).map((f) => (
                <li key={f._id} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{f.student?.firstName} {f.student?.lastName}</span><span className="text-xs text-ink-500">{fmtDate(f.contactDate)} - {f.method}</span></div>
                  <p className="text-ink-700">Contacted <b>{f.parentContacted}</b> (by {f.contactedBy?.name})</p>
                  <p className="text-ink-500">Agreed: {f.agreedAction}</p>
                </li>
              ))}
              {!fu.data?.length && <li className="py-3 text-ink-500">No follow-ups recorded yet.</li>}
            </ul>
          )}
        </div>
      </div>
      {target && <FollowUpForm student={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); fu.reload(); }} />}
    </>
  );
}
