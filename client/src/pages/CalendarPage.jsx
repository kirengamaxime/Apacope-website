import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, useFetch, fmtDate, today } from '../components/ui';

const TYPES = { term: 'Academic term', holiday: 'Holiday', exam: 'Exam', meeting: 'Meeting', makerspace: 'Maker Space', other: 'Other' };
const COLORS = { term: 'bg-sky-50 text-sky-700', holiday: 'bg-emerald-50 text-emerald-700', exam: 'bg-amber-50 text-amber-700', meeting: 'bg-violet-50 text-violet-700', makerspace: 'bg-brand-50 text-brand-700', other: 'bg-ink-100 text-ink-700' };

export default function CalendarPage() {
  const { hasRole } = useAuth();
  const manage = hasRole('dos', 'headteacher');
  const { data, loading, error, reload } = useFetch(() => api.get('/calendar/events'), []);
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ title: '', type: 'meeting', start: today(), end: '', description: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/calendar/events', { ...f, end: f.end || undefined }); setAdd(false); reload(); } catch (er) { setErr(er.message); }
  };
  const remove = async (ev) => { if (window.confirm('Delete event?')) { await api.del(`/calendar/events/${ev._id}`); reload(); } };
  const upcoming = (data || []).filter((e) => new Date(e.end || e.start) >= new Date(new Date().toDateString()));
  const past = (data || []).filter((e) => !upcoming.includes(e)).reverse();
  const List = ({ items }) => (
    <ul className="divide-y divide-ink-100">
      {items.map((e) => (
        <li key={e._id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="w-28 shrink-0 text-sm font-semibold">{fmtDate(e.start)}{e.end ? <span className="block text-xs font-normal text-ink-500">to {fmtDate(e.end)}</span> : null}</div>
          <div className="min-w-0 flex-1"><p className="font-medium">{e.title}</p>{e.description && <p className="text-sm text-ink-500">{e.description}</p>}</div>
          <span className={`badge ${COLORS[e.type]}`}>{TYPES[e.type]}</span>
          {manage && <button className="text-xs text-red-600 hover:underline" onClick={() => remove(e)}>Delete</button>}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageHeader title="School calendar" subtitle="Terms, holidays, exams, meetings and Maker Space activities">
        {manage && <button className="btn-primary" onClick={() => setAdd(true)}>Add event</button>}
      </PageHeader>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : (
        <div className="space-y-4">
          <div className="card"><h2 className="mb-1">Upcoming</h2>{upcoming.length ? <List items={upcoming} /> : <Empty text="No upcoming events." />}</div>
          {past.length > 0 && <div className="card opacity-80"><h2 className="mb-1">Past</h2><List items={past.slice(0, 10)} /></div>}
        </div>
      )}
      {add && (
        <Modal title="Add calendar event" onClose={() => setAdd(false)}>
          <Alert>{err}</Alert>
          <form onSubmit={submit} className="space-y-3">
            <div><label className="label">Title</label><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="label">Type</label><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label">Start</label><input type="date" className="input" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div><div><label className="label">End (optional)</label><input type="date" className="input" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <button className="btn-primary w-full">Save</button>
          </form>
        </Modal>
      )}
    </>
  );
}
