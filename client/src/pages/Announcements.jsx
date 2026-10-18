import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, useFetch, fmtDate } from '../components/ui';

const ROLES = ['headteacher', 'dos', 'trainer', 'student', 'parent', 'accountant', 'librarian'];

function Compose({ onClose, onDone }) {
  const { user } = useAuth();
  const isTrainer = user.role === 'trainer';
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const [f, setF] = useState({ title: '', body: '', schoolWide: !isTrainer, requiresAck: false });
  const [roles, setRoles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post('/announcements', { ...f, audienceRoles: roles, classes }); onDone(); } catch (er) { setError(er.message); }
  };
  const chip = (on) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white'}`;
  return (
    <Modal title={isTrainer ? 'Message my class' : 'New announcement'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Title</label><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label">Message</label><textarea className="input" rows={4} required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
        {!isTrainer && (
          <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.schoolWide} onChange={(e) => setF({ ...f, schoolWide: e.target.checked })} /> Whole school</label>
            {!f.schoolWide && <div><label className="label">Send to roles</label><div className="flex flex-wrap gap-2">{ROLES.map((r) => <button type="button" key={r} className={chip(roles.includes(r))} onClick={() => toggle(roles, setRoles, r)}>{r}</button>)}</div></div>}
          </>
        )}
        <div><label className="label">{isTrainer ? 'Classes' : 'Specific classes (optional)'}</label>
          <div className="flex flex-wrap gap-2">{(mine.data?.classes || []).map((c) => <button type="button" key={c._id} className={chip(classes.includes(c._id))} onClick={() => toggle(classes, setClasses, c._id)}>{c.name}</button>)}</div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.requiresAck} onChange={(e) => setF({ ...f, requiresAck: e.target.checked })} /> Require acknowledgement (read receipt)</label>
        <button className="btn-primary w-full">Send</button>
      </form>
    </Modal>
  );
}

export default function Announcements() {
  const { user, hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get(`/announcements?page=${page}`), [page]);
  const [compose, setCompose] = useState(false);
  const ack = async (a) => { await api.post(`/announcements/${a._id}/ack`); reload(); };
  const del = async (a) => { if (window.confirm('Delete this announcement?')) { await api.del(`/announcements/${a._id}`); reload(); } };
  const KIND = { announcement: 'Official', 'class-message': 'Class message', 'parent-alert': 'Parent alert' };
  return (
    <>
      <PageHeader title="Announcements" subtitle="Official notices, class messages and parent alerts">
        {hasRole('headteacher', 'dos', 'trainer') && <button className="btn-primary" onClick={() => setCompose(true)}>{user.role === 'trainer' ? 'Message class' : 'New announcement'}</button>}
      </PageHeader>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No announcements." /> : (
        <div className="space-y-3">
          {data.items.map((a) => (
            <article key={a._id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className={`badge ${a.kind === 'parent-alert' ? 'bg-red-100 text-red-700' : a.kind === 'class-message' ? 'bg-sky-50 text-sky-700' : 'bg-brand-50 text-brand-700'}`}>{KIND[a.kind]}</span><h2>{a.title}</h2></div>
                <span className="text-xs text-ink-500">{fmtDate(a.createdAt)} - {a.author?.name}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{a.body}</p>
              {a.classes?.length > 0 && <p className="mt-1 text-xs text-ink-500">Classes: {a.classes.map((c) => c.name).join(', ')}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {a.requiresAck && (a.acknowledged ? <span className="badge bg-emerald-50 text-emerald-700">Acknowledged</span> : <button className="btn-primary" onClick={() => ack(a)}>I acknowledge</button>)}
                {a.requiresAck && ['headteacher', 'dos', 'admin'].includes(user.role) && <span className="text-xs text-ink-500">{a.ackCount} acknowledged</span>}
                {hasRole('headteacher', 'dos') && <button className="btn-danger ml-auto" onClick={() => del(a)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
      {compose && <Compose onClose={() => setCompose(false)} onDone={() => { setCompose(false); reload(); }} />}
    </>
  );
}
