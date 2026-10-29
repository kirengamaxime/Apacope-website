import { useEffect, useMemo, useState } from 'react';
import { api, qs, download, blobUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, useFetch, fmtDate } from '../components/ui';
import { useDialog } from '../components/Dialog';

const KIND_ICON = { video: 'VIDEO', pdf: 'PDF', word: 'DOC', image: 'IMG', link: 'LINK' };
const ytId = (u = '') => (u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
const ENT_TYPES = ['documentary', 'career', 'quiz', 'event'];

function Viewer({ r, onClose }) {
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    api.post(`/resources/${r._id}/view`).catch(() => {});
    let url;
    if (r.file && ['image', 'pdf'].includes(r.kind)) {
      blobUrl(`/resources/${r._id}/download?inline=1`).then((u) => { url = u; setSrc(u); }).catch((e) => setErr(e.message));
    }
    return () => url && URL.revokeObjectURL(url);
  }, [r]);
  const id = ytId(r.youtubeUrl);
  return (
    <Modal title={r.title} onClose={onClose}>
      <Alert>{err}</Alert>
      {id && <div className="aspect-video overflow-hidden rounded-lg bg-black"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={r.title} allowFullScreen loading="lazy" /></div>}
      {r.kind === 'image' && src && <img src={src} alt={r.title} className="max-h-[60vh] w-full rounded-lg object-contain" />}
      {r.kind === 'pdf' && src && <iframe src={src} title={r.title} className="h-[60vh] w-full rounded-lg border" />}
      {r.file && r.kind === 'video' && src === '' && <p className="text-sm text-ink-500">Use Download to watch this video file.</p>}
      {r.kind === 'word' && <p className="rounded-lg bg-ink-50 p-4 text-sm text-ink-700">Word documents cannot be previewed in the browser. Download the file to open it.</p>}
      {r.description && <p className="mt-3 text-sm text-ink-700">{r.description}</p>}
      {r.file && <button className="btn-primary mt-3" onClick={() => download(`/resources/${r._id}/download`, r.file.originalName)}>Download</button>}
    </Modal>
  );
}

function UploadForm({ category, onDone, onClose }) {
  const { user } = useAuth();
  const mine = useFetch(() => api.get('/academic/my-classes'), []);
  const trades = useFetch(() => api.get('/academic/trades'), []);
  const modulesAll = useFetch(() => api.get('/academic/modules'), []);
  const outcomes = useFetch(() => api.get('/academic/outcomes'), []);
  const [f, setF] = useState({ title: '', description: '', youtubeUrl: '', level: '', trade: '', module: '', learningOutcome: '', entertainmentType: 'documentary' });
  const [classes, setClasses] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const allClasses = mine.data?.classes || [];
  const levelOptions = [...new Set(allClasses.map((c) => c.level))];
  const classOptions = allClasses.filter((c) => (!f.level || c.level === f.level) && (!f.trade || c.trade?._id === f.trade));
  const modOptions = (modulesAll.data || []).filter((m) => (!f.trade || m.trade?._id === f.trade) && (!f.level || m.level === f.level));
  const outOptions = (outcomes.data || []).filter((o) => o.module?._id === f.module);
  const toggle = (id) => setClasses((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const fd = new FormData();
    fd.append('category', category);
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v));
    fd.append('classes', JSON.stringify(classes));
    if (file) fd.append('file', file);
    try { await api.upload('/resources', fd); onDone(); } catch (er) { setError(er.message); } finally { setBusy(false); }
  };

  const lesson = category === 'lesson';
  return (
    <Modal title={lesson ? 'Upload learning material' : 'Suggest edutainment content'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Title</label><input className="input" required value={f.title} onChange={up('title')} /></div>
        <div><label className="label">Description</label><textarea className="input" rows={2} value={f.description} onChange={up('description')} /></div>
        {!lesson && <div><label className="label">Content type</label><select className="input" value={f.entertainmentType} onChange={up('entertainmentType')}>{ENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>}
        {lesson && (
          <fieldset className="space-y-3 rounded-lg border border-ink-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-ink-500">Who should see this?</legend>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Level</label><select className="input" required value={f.level} onChange={(e) => { setF({ ...f, level: e.target.value, module: '', learningOutcome: '' }); setClasses([]); }}><option value="">Select</option>{levelOptions.map((l) => <option key={l}>{l}</option>)}</select></div>
              <div><label className="label">Trade</label><select className="input" required value={f.trade} onChange={(e) => { setF({ ...f, trade: e.target.value, module: '', learningOutcome: '' }); setClasses([]); }}><option value="">Select</option>{(trades.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
            </div>
            <div><label className="label">Class(es)</label>
              <div className="flex flex-wrap gap-2">{classOptions.map((c) => (
                <button type="button" key={c._id} onClick={() => toggle(c._id)} className={`rounded-full border px-3 py-1 text-sm ${classes.includes(c._id) ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white'}`}>{c.name}</button>
              ))}{!classOptions.length && <span className="text-sm text-ink-500">Choose level and trade first</span>}</div>
            </div>
            <div><label className="label">Module</label><select className="input" required value={f.module} onChange={(e) => setF({ ...f, module: e.target.value, learningOutcome: '' })}><option value="">Select</option>{modOptions.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
            <div><label className="label">Learning outcome</label><select className="input" required value={f.learningOutcome} onChange={up('learningOutcome')}><option value="">Select</option>{outOptions.map((o) => <option key={o._id} value={o._id}>{o.title}</option>)}</select></div>
          </fieldset>
        )}
        <div><label className="label">YouTube link (optional)</label><input className="input" placeholder="https://www.youtube.com/watch?v=..." value={f.youtubeUrl} onChange={up('youtubeUrl')} /></div>
        <div><label className="label">...or upload a file (PDF, Word, image, MP4 - max 10 MB)</label>
          <input type="file" className="input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp4,.webm" onChange={(e) => setFile(e.target.files[0])} />
        </div>
        {!lesson && !['dos', 'headteacher', 'admin'].includes(user.role) && <p className="text-xs text-ink-500">This content will be visible to students after the school approves it.</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Uploading...' : 'Publish'}</button>
      </form>
    </Modal>
  );
}

export default function Resources({ category }) {
  const { user, hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [view, setView] = useState('all'); // all | bookmarked | pending
  const [open, setOpen] = useState(null);
  const [upload, setUpload] = useState(false);
  const params = useMemo(() => ({ page, limit: 9, category, search, kind, bookmarked: view === 'bookmarked' || undefined, pending: view === 'pending' || undefined }), [page, category, search, kind, view]);
  const { data, loading, error, reload } = useFetch(() => api.get(`/resources${qs(params)}`), [JSON.stringify(params)]);
  const history = useFetch(() => api.get('/resources/history/me'), []);
  const [showHistory, setShowHistory] = useState(false);
  const canPost = hasRole('trainer', 'dos', 'headteacher');
  const moderator = hasRole('dos', 'headteacher');
  const isStudent = user.role === 'student';

  const bookmark = async (r) => { await api.post(`/resources/${r._id}/bookmark`); reload(); };
  const approve = async (r, approved) => { await api.put(`/resources/${r._id}/approve`, { approved }); reload(); };
  const dialog = useDialog();
  const edit = async (r) => {
    const v = await dialog.form({
      title: 'Edit this resource', confirmText: 'Save changes',
      fields: [{ name: 'title', label: 'Title', value: r.title, required: true }, { name: 'description', label: 'Description', value: r.description || '', multiline: true }],
    });
    if (!v) return;
    try { await api.put(`/resources/${r._id}`, { title: v.title || r.title, description: v.description }); reload(); } catch (e) { dialog.alert({ title: 'Could not save the changes', message: e.message }); }
  };
  const remove = async (r) => { if (await dialog.confirm({ title: 'Delete this resource?', message: r.title, confirmText: 'Delete resource', danger: true })) { await api.del(`/resources/${r._id}`); reload(); } };

  return (
    <>
      <PageHeader title={category === 'lesson' ? 'Learning Materials' : 'Educational Entertainment'}
        subtitle={category === 'lesson' ? (isStudent ? 'Materials shared with your class' : 'Share videos, handouts and images with targeted classes') : 'Approved documentaries, career guidance, quizzes and school events'}>
        {canPost && <button className="btn-primary" onClick={() => setUpload(true)}>{category === 'lesson' ? 'Upload material' : 'Add content'}</button>}
        <button className="btn-ghost" onClick={() => setShowHistory(true)}>My history</button>
      </PageHeader>

      <div className="card mb-4 grid gap-3 sm:grid-cols-[1fr_160px_160px]">
        <input className="input" placeholder="Search by title or description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
          <option value="">All types</option>{['video', 'pdf', 'word', 'image'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select className="input" value={view} onChange={(e) => { setView(e.target.value); setPage(1); }}>
          <option value="all">All</option><option value="bookmarked">Bookmarked</option>{moderator && <option value="pending">Awaiting approval</option>}
        </select>
      </div>

      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.items?.length ? <Empty text="No materials found." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((r) => (
            <div key={r._id} className="card flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="badge bg-brand-50 text-brand-700">{KIND_ICON[r.kind]}</span>
                <button onClick={() => bookmark(r)} className={`text-sm ${r.bookmarked ? 'font-semibold text-brand-600' : 'text-ink-500 hover:text-ink-900'}`}>{r.bookmarked ? 'Saved' : 'Bookmark'}</button>
              </div>
              <h2 className="line-clamp-2">{r.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink-500">{r.description}</p>
              <p className="mt-2 text-xs text-ink-500">
                {r.module?.name && <>{r.module.name} - </>}{r.classes?.map((c) => c.name).join(', ')}{r.entertainmentType && <span className="capitalize">{r.entertainmentType}</span>}
              </p>
              <p className="text-xs text-ink-500">By {r.uploadedBy?.name} on {fmtDate(r.createdAt)}{r.file ? ` - ${r.downloads} downloads` : ''}</p>
              {!r.approved && <p className="mt-1 text-xs font-medium text-amber-700">Awaiting approval</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <button className="btn-primary flex-1" onClick={() => setOpen(r)}>Preview</button>
                {r.file && <button className="btn-ghost" onClick={() => download(`/resources/${r._id}/download`, r.file.originalName).then(history.reload)}>Download</button>}
                {moderator && r.category === 'entertainment' && <button className="btn-ghost" onClick={() => approve(r, !r.approved)}>{r.approved ? 'Unpublish' : 'Approve'}</button>}
                {canPost && (user.role !== 'trainer' || r.uploadedBy?.name === user.name) && <><button className="btn-ghost" onClick={() => edit(r)}>Edit</button><button className="btn-danger" onClick={() => remove(r)}>Delete</button></>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={data?.pages} onChange={setPage} />

      {open && <Viewer r={open} onClose={() => { setOpen(null); history.reload(); }} />}
      {upload && <UploadForm category={category} onClose={() => setUpload(false)} onDone={() => { setUpload(false); reload(); }} />}
      {showHistory && (
        <Modal title="My view & download history" onClose={() => setShowHistory(false)}>
          <ul className="divide-y divide-ink-100 text-sm">
            {(history.data || []).map((h) => <li key={h._id} className="flex justify-between gap-2 py-2"><span className="truncate">{h.resource?.title || 'Removed item'}</span><span className="shrink-0 text-ink-500">{h.action} - {fmtDate(h.createdAt)}</span></li>)}
            {!history.data?.length && <li className="py-3 text-ink-500">Nothing yet.</li>}
          </ul>
        </Modal>
      )}
    </>
  );
}