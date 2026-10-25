import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, useFetch, fmtDate } from '../components/ui';

const MARKS = {
  open: ['Open', 'bg-sky-50 text-sky-800'],
  pending: ['Waiting for DOS', 'bg-amber-50 text-amber-800'],
  approved: ['Marks approved', 'bg-emerald-50 text-emerald-700'],
  returned: ['Returned to trainer', 'bg-red-100 text-red-700'],
};
export function MarksPill({ status }) {
  const [label, cls] = MARKS[status] || MARKS.open;
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const TYPE_LABEL = { formative: 'Formative', summative: 'Summative', comprehensive: 'Comprehensive' };

const MINE = {
  new: ['To do', 'bg-sky-50 text-sky-800'],
  started: ['In progress', 'bg-amber-50 text-amber-800'],
  submitted: ['Sent to trainer', 'bg-ink-100 text-ink-700'],
};
export const isLate = (a) => a.dueDate && new Date(a.dueDate).setHours(23, 59, 59, 999) < Date.now();

/** What a learner sees: their assignments and where each one stands */
function LearnerList({ items }) {
  if (!items.length) return <Empty text="No assignments for you yet." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((a) => {
        const done = a.mine.status === 'submitted';
        const [label, cls] = MINE[a.mine.status] || MINE.new;
        return (
          <Link key={a._id} to={`/assignments/${a._id}`} className="card block transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div><h2>{a.title}</h2><p className="text-sm text-ink-500">{a.module?.name} - {a.trainer?.name} - {TYPE_LABEL[a.type] || 'Formative'}</p></div>
              {a.mine.total !== null ? <span className="badge bg-emerald-50 text-emerald-700">Marks ready</span> : <span className={`badge ${cls}`}>{label}</span>}
            </div>
            <p className="mt-3 text-sm text-ink-500">{a.questionCount} question{a.questionCount === 1 ? '' : 's'} - {a.points} points{a.dueDate ? ` - due ${fmtDate(a.dueDate)}` : ''}</p>
            {!done && isLate(a) && <p className="mt-1 text-sm font-medium text-brand-700">The deadline has passed</p>}
            {done && a.mine.total === null && <p className="mt-1 text-sm text-ink-500">Your marks will appear here as soon as your trainer has marked it.</p>}
            <p className="mt-3 text-sm font-semibold text-brand-700">{a.mine.total !== null ? 'See my marks' : done ? 'Open' : a.mine.status === 'started' ? 'Continue' : 'Start'} &rarr;</p>
          </Link>
        );
      })}
    </div>
  );
}

export default function Assignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const learner = user.role === 'student';
  const trainer = user.role === 'trainer';
  const [tab, setTab] = useState(learner || trainer ? '' : 'pending');
  const { data, loading, error, reload } = useFetch(() => api.get(`/online-assignments${qs({ marksStatus: tab })}`), [tab]);
  const [err, setErr] = useState('');
  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?\n\nEvery learner's answers for it are deleted too. This cannot be undone.`)) return;
    setErr('');
    try { await api.del(`/online-assignments/${a._id}`); reload(); } catch (e) { setErr(e.message); }
  };
  const tabs = [['pending', 'Waiting for DOS'], ['returned', 'Returned'], ['approved', 'Approved'], ['open', 'Open'], ['', 'All']];

  return (
    <>
      <PageHeader
        title={learner ? 'My assignments' : trainer ? 'Online assignments' : 'Assignment marks'}
        subtitle={learner ? 'Answer your assignments here on the screen, then send them to your trainer' : trainer ? 'Write an assignment for chosen learners, mark their answers and send the marks to the DOS' : 'Approve the marks trainers sent you for online assignments'}>
        {trainer && <button className="btn-primary" onClick={() => navigate('/assignments/new')}>New assignment</button>}
        {!learner && !trainer && data?.pending > 0 && <span className="badge bg-amber-50 text-amber-800">{data.pending} waiting for review</span>}
      </PageHeader>
      {!learner && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(trainer ? tabs.slice(1) : tabs).map(([k, label]) => (
            <button key={k || 'all'} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${tab === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700'}`}>{label}</button>
          ))}
        </div>
      )}
      <Alert>{error || err}</Alert>
      {loading ? <Spinner /> : learner ? <LearnerList items={data?.items || []} /> : !data?.items?.length ? <Empty text={trainer ? 'No assignments yet. Press "New assignment" to write one.' : 'Nothing here.'} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr className="border-b border-ink-200"><th className="th">Assignment</th><th className="th">Class / module</th>{!trainer && <th className="th">Trainer</th>}<th className="th">Due</th><th className="th">Sent</th><th className="th">Marked</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a._id} className="border-b border-ink-100">
                  <td className="td font-medium">{a.title}{a.status === 'draft' && <span className="badge ml-2 bg-ink-100 text-ink-700">Draft</span>}<span className="block text-xs font-normal text-ink-500">{TYPE_LABEL[a.type] || 'Formative'} - {a.questionCount} questions - {a.points} points</span></td>
                  <td className="td">{a.class?.name}<span className="block text-xs text-ink-500">{a.module?.name}</span></td>
                  {!trainer && <td className="td">{a.trainer?.name}</td>}
                  <td className="td text-ink-500">{a.dueDate ? fmtDate(a.dueDate) : '-'}</td>
                  <td className="td">{a.submitted}/{a.recipients}</td><td className="td">{a.marked}/{a.submitted}</td>
                  <td className="td"><MarksPill status={a.marksStatus} /></td>
                  <td className="td whitespace-nowrap text-right">
                    <Link className="btn-ghost" to={`/assignments/${a._id}`}>{!trainer && a.marksStatus === 'pending' ? 'Review' : 'Open'}</Link>
                    {trainer && !['pending', 'approved'].includes(a.marksStatus) && <><Link className="btn-ghost" to={`/assignments/${a._id}/edit`}>Edit</Link><button className="btn-danger" onClick={() => remove(a)}>Delete</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}