import { useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, useFetch, fmtDate } from '../components/ui';

const STATUS = {
  submitted: ['Waiting for DOS', 'bg-amber-50 text-amber-800'],
  approved: ['Approved', 'bg-emerald-50 text-emerald-700'],
  returned: ['Returned to trainer', 'bg-red-100 text-red-700'],
  draft: ['Draft', 'bg-ink-100 text-ink-700'],
};
const TABS = [['submitted', 'Waiting for DOS'], ['returned', 'Returned'], ['approved', 'Approved'], ['draft', 'Drafts'], ['', 'All sent']];

export function StatusPill({ status }) {
  const [label, cls] = STATUS[status] || STATUS.draft;
  return <span className={`badge ${cls}`}>{label}</span>;
}

/** Marks of one submission, with the DOS decision buttons */
function Review({ sub, canDecide, onClose, onDone }) {
  const { data, loading, error } = useFetch(() => api.get(`/mark-submissions/${sub._id}/sheet`), [sub._id]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const decide = async (what) => {
    setErr('');
    if (what === 'return' && !comment.trim()) return setErr('Write a short reason so the trainer knows what to correct.');
    setBusy(what);
    try { await api.post(`/mark-submissions/${sub._id}/${what}`, { comment }); onDone(); } catch (e) { setErr(e.message); setBusy(''); }
  };
  const decidable = canDecide && ['submitted', 'approved'].includes(sub.status);
  return (
    <Modal title={`${sub.module?.name} - ${sub.class?.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-500">Trainer: <b className="text-ink-900">{sub.trainer?.name || '-'}</b> - {sub.term?.name || 'No term'} - <StatusPill status={sub.status} /></p>
      {sub.reviewComment && <Alert kind={sub.status === 'returned' ? 'error' : 'ok'}>{`DOS note: ${sub.reviewComment}`}</Alert>}
      <Alert>{error || err}</Alert>
      {loading ? <Spinner /> : !data?.rows?.length ? <Empty text="No learners in this class." /> : (
        <div className="max-h-[50vh] overflow-auto rounded-md border border-ink-200">
          <table className="w-full min-w-[480px]">
            <thead><tr>
              <th className="th">Learner</th>
              {data.columns.map((c, i) => <th key={i} className="th whitespace-nowrap">{c.title || c.type}<span className="block font-normal">/{c.maxScore}</span></th>)}
              <th className="th">Total</th><th className="th">%</th><th className="th">Grade</th>
            </tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.student} className="border-b border-ink-100">
                  <td className="td font-medium">{r.name}<span className="block text-xs font-normal text-ink-500">{r.admissionNo}</span></td>
                  {r.scores.map((s, i) => <td key={i} className="td">{s ?? '-'}</td>)}
                  <td className="td whitespace-nowrap">{r.total}/{r.max}</td><td className="td">{r.max ? `${r.percentage}%` : '-'}</td><td className="td font-semibold">{r.max ? r.grade : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {decidable && (
        <div className="mt-4 space-y-3">
          <div><label className="label">Note to the trainer {sub.status === 'submitted' ? '(required only when returning)' : '(required to reopen)'}</label>
            <textarea className="input min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: Quiz 2 scores for two learners look too low, please check." /></div>
          <div className="flex gap-2">
            {sub.status === 'submitted' && <button className="btn-primary flex-1" disabled={!!busy} onClick={() => decide('approve')}>Approve marks</button>}
            <button className="btn-danger flex-1" disabled={!!busy} onClick={() => decide('return')}>{sub.status === 'approved' ? 'Reopen for correction' : 'Return to trainer'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function MarksReview() {
  const { user, hasRole } = useAuth();
  const trainer = user.role === 'trainer';
  const canDecide = hasRole('dos');
  const [tab, setTab] = useState(trainer ? '' : 'submitted');
  const { data, loading, error, reload } = useFetch(() => api.get(`/mark-submissions${qs({ status: tab })}`), [tab]);
  const [open, setOpen] = useState(null);

  return (
    <>
      <PageHeader title={trainer ? 'My marks submissions' : 'Marks review'}
        subtitle={trainer ? 'See which of your marks the DOS has approved or sent back' : 'Check the marks trainers have submitted, then approve them or send them back with a note'}>
        {!trainer && data?.pending > 0 && <span className="badge bg-amber-50 text-amber-800">{data.pending} waiting for review</span>}
      </PageHeader>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([k, label]) => (
          <button key={k || 'all'} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${tab === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700'}`}>{label}</button>
        ))}
      </div>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text={tab === 'submitted' ? 'Nothing is waiting for review.' : 'No submissions here.'} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-ink-200"><th className="th">Class</th><th className="th">Module</th><th className="th">Term</th><th className="th">Trainer</th><th className="th">Marks</th><th className="th">Submitted</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s._id} className="border-b border-ink-100">
                  <td className="td font-medium">{s.class?.name}</td><td className="td">{s.module?.name}</td><td className="td">{s.term?.name || '-'}</td><td className="td">{s.trainer?.name || '-'}</td>
                  <td className="td">{s.marks}</td><td className="td text-ink-500">{s.submittedAt ? fmtDate(s.submittedAt) : '-'}</td><td className="td"><StatusPill status={s.status} /></td>
                  <td className="td text-right"><button className="btn-ghost" onClick={() => setOpen(s)}>{canDecide && s.status === 'submitted' ? 'Review' : 'View'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <Review sub={open} canDecide={canDecide} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}
    </>
  );
}