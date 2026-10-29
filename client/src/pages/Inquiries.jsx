import { useState } from 'react';
import { api } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, Pagination, useFetch } from '../components/ui';
import { useDialog } from '../components/Dialog';

export default function Inquiries() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get(`/public/messages?page=${page}`), [page]);
  const toggle = async (m) => { await api.put(`/public/messages/${m._id}/read`, { read: !m.read }); reload(); };
  const dialog = useDialog();
  const remove = async (m) => { if (await dialog.confirm({ title: 'Delete this message?', message: `The message from ${m.name} will be deleted.`, confirmText: 'Delete message', danger: true })) { await api.del(`/public/messages/${m._id}`); reload(); } };
  return (
    <>
      <PageHeader title="Website inquiries" subtitle={data ? `${data.unread} unread of ${data.total}` : 'Messages from the public contact form'} />
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No messages yet." /> : (
        <div className="space-y-3">
          {data.items.map((m) => (
            <article key={m._id} className={`card ${m.read ? 'opacity-70' : 'border-l-4 border-l-brand-600'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><h2>{m.name}</h2><span className="badge bg-ink-100 capitalize text-ink-700">{m.topic}</span></div>
                <span className="text-xs text-ink-500">{new Date(m.createdAt).toLocaleString('en-GB')}</span>
              </div>
              <p className="mt-1 text-sm text-ink-500">{[m.email, m.phone].filter(Boolean).join(' - ')}</p>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{m.message}</p>
              <div className="mt-3 flex gap-2"><button className="btn-ghost" onClick={() => toggle(m)}>{m.read ? 'Mark as unread' : 'Mark as read'}</button><button className="btn-danger" onClick={() => remove(m)}>Delete</button></div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
    </>
  );
}