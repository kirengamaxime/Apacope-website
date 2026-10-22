import { useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, StatusBadge, useFetch } from '../components/ui';

const STATUSES = ['active', 'transferred', 'graduated', 'dropped'];

/** Used both to admit a new student and to edit an existing one */
function StudentForm({ student, onClose, onDone }) {
  const edit = !!student;
  const classes = useFetch(() => api.get('/academic/classes'), []);
  const [f, setF] = useState({
    admissionNo: student?.admissionNo || '',
    firstName: student?.firstName || '',
    lastName: student?.lastName || '',
    gender: student?.gender || 'M',
    dob: student?.dob ? String(student.dob).slice(0, 10) : '',
    class: student?.class?._id || '',
    status: student?.status || 'active',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (edit) await api.put(`/students/${student._id}`, f);
      else await api.post('/students', { ...f, dob: f.dob || undefined });
      onDone();
    } catch (er) { setError(er.message); setBusy(false); }
  };
  return (
    <Modal title={edit ? 'Edit student' : 'Admit student'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Admission number</label><input className="input" required value={f.admissionNo} onChange={up('admissionNo')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">First name</label><input className="input" required value={f.firstName} onChange={up('firstName')} /></div><div><label className="label">Last name</label><input className="input" required value={f.lastName} onChange={up('lastName')} /></div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Gender</label><select className="input" value={f.gender} onChange={up('gender')}><option value="M">Male</option><option value="F">Female</option></select></div><div><label className="label">Date of birth</label><input type="date" className="input" value={f.dob} onChange={up('dob')} /></div></div>
        <div><label className="label">Class</label><select required className="input" value={f.class} onChange={up('class')}><option value="">Select</option>{(classes.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        {edit && <div><label className="label">Status</label><select className="input capitalize" value={f.status} onChange={up('status')}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
        <button className="btn-primary w-full" disabled={busy}>{edit ? 'Save changes' : 'Admit'}</button>
      </form>
    </Modal>
  );
}

function LinkParent({ student, onClose }) {
  const parents = useFetch(() => api.get('/users?role=parent&limit=100'), []);
  const [userId, setUserId] = useState('');
  const [msg, setMsg] = useState(''); const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault(); try { await api.post(`/students/${student._id}/link-parent`, { userId, relationship: 'Parent' }); setMsg('Linked.'); } catch (er) { setError(er.message); } };
  return (
    <Modal title={`Link parent: ${student.firstName} ${student.lastName}`} onClose={onClose}>
      <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <select className="input" required value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Choose parent account</option>{(parents.data?.items || []).map((p) => <option key={p._id} value={p._id}>{p.name} ({p.email})</option>)}</select>
        <button className="btn-primary w-full">Link</button>
      </form>
    </Modal>
  );
}

export default function Students() {
  const { hasRole } = useAuth();
  const manage = hasRole('dos', 'headteacher');
  const classes = useFetch(() => api.get('/academic/my-classes'), []);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const { data, loading, error, reload } = useFetch(() => api.get(`/students${qs({ page, search, class: classId })}`), [page, search, classId]);
  const [form, setForm] = useState(null); // null | {} (admit) | student (edit)
  const [link, setLink] = useState(null);
  const [err, setErr] = useState('');
  const remove = async (s) => {
    const name = `${s.firstName} ${s.lastName}`;
    if (!window.confirm(`Permanently delete ${name} (${s.admissionNo})?\n\nThis also erases their marks, attendance, invoices, receipts and report comments, and their login. It cannot be undone.\n\nTo keep their history, press Cancel and use Edit to set the status to Dropped or Transferred instead.`)) return;
    setErr('');
    try { await api.del(`/students/${s._id}`); reload(); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <PageHeader title="Students" subtitle={data ? `${data.total} students` : ''}>{manage && <button className="btn-primary" onClick={() => setForm({})}>Admit student</button>}</PageHeader>
      <div className="card mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <input className="input" placeholder="Search name or admission no..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}><option value="">All classes</option>{(classes.data?.classes || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
      </div>
      <Alert>{error || err}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No students found." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead><tr className="border-b border-ink-200"><th className="th">Adm. no</th><th className="th">Name</th><th className="th">Gender</th><th className="th">Class</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s._id} className="border-b border-ink-100"><td className="td">{s.admissionNo}</td><td className="td font-medium">{s.lastName} {s.firstName}</td><td className="td">{s.gender}</td><td className="td">{s.class?.name}</td><td className="td"><StatusBadge status={s.status} /></td>
                  <td className="td whitespace-nowrap text-right">{manage && <><button className="btn-ghost" onClick={() => setForm(s)}>Edit</button><button className="btn-ghost" onClick={() => setLink(s)}>Link parent</button><button className="btn-danger" onClick={() => remove(s)}>Delete</button></>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />
      {form && <StudentForm student={form._id ? form : null} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} />}
      {link && <LinkParent student={link} onClose={() => setLink(null)} />}
    </>
  );
}