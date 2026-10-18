import { useState } from 'react';
import { api, qs } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, Pagination, useFetch } from '../components/ui';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, loading, error } = useFetch(() => api.get(`/users/audit/logs${qs({ page, action })}`), [page, action]);
  return (
    <>
      <PageHeader title="Audit logs" subtitle="Who changed marks, edited attendance, uploaded files and more" />
      <div className="card mb-4"><input className="input sm:w-72" placeholder="Filter by action, e.g. MARKS_CHANGE" value={action} onChange={(e) => { setAction(e.target.value.toUpperCase()); setPage(1); }} /></div>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No log entries." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-ink-200"><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Details</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l._id} className="border-b border-ink-100 align-top">
                  <td className="td whitespace-nowrap text-ink-500">{new Date(l.createdAt).toLocaleString('en-GB')}</td>
                  <td className="td">{l.userName}<span className="block text-xs text-ink-500">{l.role}</span></td>
                  <td className="td"><span className="badge bg-ink-100 text-ink-700">{l.action}</span></td>
                  <td className="td">{l.entity}</td>
                  <td className="td max-w-xs break-words text-xs text-ink-500">{l.details ? JSON.stringify(l.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
    </>
  );
}
