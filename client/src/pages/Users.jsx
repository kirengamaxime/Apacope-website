import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../components/Layout';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, useFetch, fmtDate } from '../components/ui';

const STAFF = ['headteacher', 'dos', 'trainer', 'accountant', 'librarian'];
const OTHER = ['student', 'parent', 'admin'];

/** Shown once after an account is created or a password is reset */
function Credentials({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const { user, tempPassword } = result;
  const text = `School portal login\nEmail: ${user.email}\nTemporary password: ${tempPassword}\n(You will be asked to choose your own password at first login.)`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard unavailable */ } };
  return (
    <Modal title="Login details" onClose={onClose}>
      <Alert kind="ok">{`Account ready for ${user.name} (${ROLE_LABEL[user.role]}).`}</Alert>
      <dl className="space-y-2 rounded-md border border-ink-200 bg-ink-50 p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Email</dt><dd className="font-medium break-all">{user.email}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Temporary password</dt><dd className="font-mono text-base font-semibold tracking-wide">{tempPassword}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-ink-500">This password is shown only now and is not stored in readable form. Give it to the user in person; they must choose their own at first login.</p>
      <div className="mt-4 flex gap-2">
        <button className="btn-ghost flex-1" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy details'}</button>
        <button className="btn-primary flex-1" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function UserForm({ user, onClose, onDone }) {
  const edit = !!user;
  const students = useFetch(() => (edit ? Promise.resolve(null) : api.get('/students?limit=100')), []);
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: user?.role || 'trainer', password: '', active: user?.active ?? true, studentId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (edit) { await api.put(`/users/${user._id}`, { name: f.name, phone: f.phone, role: f.role, active: f.active }); onDone(); }
      else onDone(await api.post('/users', { name: f.name, email: f.email, phone: f.phone, role: f.role, password: f.password || undefined, studentId: f.studentId || undefined }));
    } catch (er) { setError(er.message); setBusy(false); }
  };
  return (
    <Modal title={edit ? 'Edit user' : 'Create account'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={up('name')} /></div>
        <div><label className="label">Email (used to log in)</label><input type="email" className="input" required disabled={edit} value={f.email} onChange={up('email')} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={up('phone')} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={f.role} onChange={up('role')}>
              <optgroup label="School staff">{STAFF.map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}</optgroup>
              <optgroup label="Learners and families">{OTHER.slice(0, 2).map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}</optgroup>
              <optgroup label="Technical"><option value="admin">{ROLE_LABEL.admin}</option></optgroup>
            </select></div>
        </div>
        {!edit && f.role === 'student' && (
          <div><label className="label">Link to student record</label>
            <select className="input" value={f.studentId} onChange={up('studentId')}><option value="">Choose later</option>{(students.data?.items || []).filter((s) => !s.user).map((s) => <option key={s._id} value={s._id}>{s.admissionNo} - {s.lastName} {s.firstName}</option>)}</select></div>
        )}
        {!edit && <div><label className="label">Password</label><input className="input" minLength={8} placeholder="Leave empty to generate a one-time password" value={f.password} onChange={up('password')} autoComplete="off" /></div>}
        {edit && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Account active (untick to block login)</label>}
        <button className="btn-primary w-full" disabled={busy}>{edit ? 'Save changes' : 'Create account'}</button>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { hasRole } = useAuth();
  const admin = hasRole(); // System Administrator only
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get(`/users${qs({ page, role, search })}`), [page, role, search]);
  const [form, setForm] = useState(null); // null | {} | user
  const [creds, setCreds] = useState(null);
  const [err, setErr] = useState('');
  const reset = async (u) => {
    if (!window.confirm(`Generate a new one-time password for ${u.name}? Their current password stops working.`)) return;
    try { setCreds(await api.post(`/users/${u._id}/reset-password`)); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <PageHeader title="Users and roles" subtitle={admin ? 'Create login accounts for staff, learners and parents, and control access' : 'Accounts are created and managed by the System Administrator'}>
        {admin && <button className="btn-primary" onClick={() => setForm({})}>Create account</button>}
      </PageHeader>
      <div className="card mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <input className="input" placeholder="Search by name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <Alert>{error || err}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No users." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead><tr className="border-b border-ink-200"><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Last login</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u._id} className="border-b border-ink-100"><td className="td font-medium">{u.name}</td><td className="td">{u.email}</td><td className="td">{ROLE_LABEL[u.role]}</td><td className="td text-ink-500">{u.lastLogin ? fmtDate(u.lastLogin) : 'Never'}</td>
                  <td className="td"><span className={`badge ${!u.active ? 'bg-red-100 text-red-700' : u.mustChangePassword ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{!u.active ? 'Disabled' : u.mustChangePassword ? 'Not yet logged in' : 'Active'}</span></td>
                  <td className="td whitespace-nowrap text-right">{admin && <><button className="btn-ghost" onClick={() => setForm(u)}>Edit</button><button className="btn-ghost" onClick={() => reset(u)}>Reset password</button></>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
      {form && <UserForm user={form._id ? form : null} onClose={() => setForm(null)} onDone={(r) => { setForm(null); if (r?.tempPassword) setCreds(r); reload(); }} />}
      {creds && <Credentials result={creds} onClose={() => { setCreds(null); reload(); }} />}
    </>
  );
}
