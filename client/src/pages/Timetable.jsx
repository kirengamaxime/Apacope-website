import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { PageHeader, Alert, Spinner, Modal, useFetch } from '../components/ui';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KIND_LABEL = { trainer: 'Trainer double-booked', room: 'Room double-booked', class: 'Class double-booked' };
const TYPE_STYLE = { lesson: 'border-l-brand-600 bg-white', practical: 'border-l-emerald-600 bg-emerald-50/40', exam: 'border-l-amber-500 bg-amber-50/60' };

function SlotForm({ slot, onClose, onDone }) {
  const edit = !!slot;
  const classes = useFetch(() => api.get('/academic/classes'), []);
  const modules = useFetch(() => api.get('/academic/modules'), []);
  const trainers = useFetch(() => api.get('/users/lookup?role=trainer'), []);
  const [f, setF] = useState(edit
    ? { class: slot.class?._id || '', module: slot.module?._id || '', trainer: slot.trainer?._id || '', day: slot.day, startTime: slot.startTime || '', endTime: slot.endTime || '', room: slot.room || '', type: slot.type }
    : { class: '', module: '', trainer: '', day: 1, startTime: '08:00', endTime: '10:00', room: '', type: 'lesson' });
  const [error, setError] = useState('');
  const [clashes, setClashes] = useState([]);
  const [problem, setProblem] = useState('');
  const [forced, setForced] = useState(false); // the server found a clash the live check had not shown yet
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // warn as soon as the chosen day, time, trainer, room or class collides with another slot
  useEffect(() => {
    if (!f.class || !f.trainer) { setClashes([]); setProblem(''); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      api.post('/calendar/timetable/check', { ...f, day: Number(f.day), id: edit ? slot._id : undefined })
        .then((d) => { if (live) { setClashes(d.clashes || []); setProblem(d.problem || ''); setForced(false); } })
        .catch(() => {});
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [f.class, f.trainer, f.day, f.startTime, f.endTime, f.room]);

  const hasClash = clashes.length > 0 || forced;
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const body = { ...f, day: Number(f.day), ...(hasClash ? { force: true } : {}) };
      if (edit) await api.put(`/calendar/timetable/${slot._id}`, body); else await api.post('/calendar/timetable', body);
      onDone();
    } catch (er) { setError(er.message); if (er.status === 409) setForced(true); }
  };
  return (
    <Modal title={edit ? 'Edit lesson / practical / exam' : 'Add lesson / practical / exam'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Class</label><select required className="input" value={f.class} onChange={up('class')}><option value="">Select</option>{(classes.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className="label">Type</label><select className="input" value={f.type} onChange={up('type')}><option value="lesson">Lesson</option><option value="practical">Practical</option><option value="exam">Exam</option></select></div>
        </div>
        <div><label className="label">Module</label><select required className="input" value={f.module} onChange={up('module')}><option value="">Select</option>{(modules.data || []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select></div>
        <div><label className="label">Trainer</label><select required className="input" value={f.trainer} onChange={up('trainer')}><option value="">Select</option>{(trainers.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1"><label className="label">Day</label><select className="input" value={f.day} onChange={up('day')}>{DAYS.slice(1, 7).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></div>
        <div><label className="label">Start</label><input type="time" className="input" value={f.startTime} onChange={up('startTime')} /></div>
        <div><label className="label">End</label><input type="time" className="input" value={f.endTime} onChange={up('endTime')} /></div>
        </div>
        <div><label className="label">Room</label><input className="input" value={f.room} onChange={up('room')} placeholder="Lab 1" /></div>
        {problem && <p className="rounded-md bg-amber-50 p-2.5 text-sm text-amber-900">{problem}</p>}
        {clashes.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p className="font-semibold">This slot clashes with another one</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{clashes.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
            <p className="mt-2 text-xs">Change the time, trainer or room to fix it. Only save it as it is if the clash is intended, for example two classes taught together.</p>
          </div>
        )}
        <button className={hasClash ? 'btn-danger w-full' : 'btn-primary w-full'}>{hasClash ? 'Save anyway (clash)' : 'Save'}</button>
      </form>
    </Modal>
  );
}

export default function Timetable() {
  const { user, hasRole } = useAuth();
  const { t: tr } = useLang();
  const manage = hasRole('dos', 'headteacher');
  const classes = useFetch(() => api.get('/academic/my-classes'), []);
  const [classId, setClassId] = useState('');
  const [mineOnly, setMineOnly] = useState(user.role === 'trainer');
  const { data, loading, error, reload } = useFetch(() => api.get(`/calendar/timetable${qs({ class: classId, mine: mineOnly || undefined })}`), [classId, mineOnly]);
  const [form, setForm] = useState(null); // null | {} (add) | slot (edit)
  // slots that are double-booked right now (only the DOS and head teacher manage the timetable, so only they see this)
  const clash = useFetch(() => (manage ? api.get('/calendar/timetable/clashes') : Promise.resolve(null)), [manage]);
  const clashOf = useMemo(() => {
    const map = new Map();
    (clash.data?.clashes || []).forEach((c) => [c.a, c.b].forEach((x, i) => {
      const other = i === 0 ? c.b : c.a;
      map.set(x._id, [...(map.get(x._id) || []), { kind: c.kind, other }]);
    }));
    return map;
  }, [clash.data]);
  const refresh = () => { reload(); clash.reload(); };
  const remove = async (t) => { if (window.confirm('Remove this slot? The class will be notified.')) { await api.del(`/calendar/timetable/${t._id}`); refresh(); } };
  const showClassFilter = !['student'].includes(user.role);

  return (
    <>
      <PageHeader title={tr('Timetable')} subtitle={tr('Lessons, practical sessions and exams')}>
        {showClassFilter && (
          <select className="input w-48" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{tr('All classes')}</option>{(classes.data?.classes || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}
        {user.role === 'trainer' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> My lessons only</label>}
        {manage && <button className="btn-primary" onClick={() => setForm({})}>Add slot</button>}
      </PageHeader>
      <Alert>{error}</Alert>
      {manage && (clash.data?.clashes || []).length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p className="font-semibold">{clash.data.clashes.length} double-booking{clash.data.clashes.length === 1 ? '' : 's'} in the timetable</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {clash.data.clashes.slice(0, 8).map((c, i) => (
              <li key={i}>{DAYS[c.a.day]}: {KIND_LABEL[c.kind].toLowerCase()} - {c.a.class} {c.a.module} ({c.a.startTime}-{c.a.endTime}) and {c.b.class} {c.b.module} ({c.b.startTime}-{c.b.endTime}){c.kind === 'trainer' ? `, ${c.a.trainer}` : c.kind === 'room' ? `, ${c.a.room}` : ''}</li>
            ))}
          </ul>
          {clash.data.clashes.length > 8 && <p className="mt-1 text-xs">and {clash.data.clashes.length - 8} more. Slots with a problem are marked in red below.</p>}
        </div>
      )}
      {loading ? <Spinner /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.slice(1, 7).map((d, i) => {
            const slots = (data || []).filter((t) => t.day === i + 1);
            return (
              <div key={d} className="card">
                <h2 className="mb-2">{tr(d)}</h2>
                {!slots.length && <p className="text-sm text-ink-500">{tr('No sessions.')}</p>}
                <ul className="space-y-2">
                  {slots.map((t) => (
                    <li key={t._id} className={`rounded-lg border border-l-4 p-2.5 text-sm ${clashOf.has(t._id) ? 'border-red-300 border-l-red-600 bg-red-50' : `border-ink-200 ${TYPE_STYLE[t.type]}`}`}>
                      <div className="flex items-start justify-between gap-2"><p className="font-semibold">{t.startTime} - {t.endTime}</p><span className="badge bg-ink-100 capitalize text-ink-700">{tr(t.type)}</span></div>
                      <p>{t.module?.name}</p>
                      <p className="text-xs text-ink-500">{t.class?.name} - {t.trainer?.name}{t.room ? ` - ${t.room}` : ''}</p>
                      {manage && [...new Set((clashOf.get(t._id) || []).map((c) => c.kind))].map((k) => <span key={k} className="badge mr-1 mt-1 bg-red-100 text-red-700">{KIND_LABEL[k]}</span>)}
                      {manage && <div className="mt-1 flex gap-3 text-xs"><button className="text-brand-700 hover:underline" onClick={() => setForm(t)}>Edit</button><button className="text-red-600 hover:underline" onClick={() => remove(t)}>Remove</button></div>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {form && <SlotForm slot={form._id ? form : null} onClose={() => setForm(null)} onDone={() => { setForm(null); refresh(); }} />}
    </>
  );
}