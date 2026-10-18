import { useState } from 'react';
import { api } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, Modal, useFetch, fmtDate } from '../components/ui';

/* Config-driven CRUD for the academic structure:
   Academic Years, Terms, Trades, Classes, Modules, Learning Outcomes, Trainer assignments */
const ENTITIES = {
  years: { label: 'Academic Years', fields: [{ k: 'name', l: 'Year (e.g. 2026)', t: 'text' }, { k: 'startDate', l: 'Start', t: 'date' }, { k: 'endDate', l: 'End', t: 'date' }, { k: 'current', l: 'Current year', t: 'bool' }], show: (r) => [r.name, r.current ? 'Current' : ''] },
  terms: { label: 'Terms', fields: [{ k: 'academicYear', l: 'Academic year', t: 'ref', from: 'years', text: 'name' }, { k: 'name', l: 'Term name', t: 'text' }, { k: 'startDate', l: 'Start', t: 'date' }, { k: 'endDate', l: 'End', t: 'date' }, { k: 'current', l: 'Current term', t: 'bool' }], show: (r) => [`${r.name} (${r.academicYear?.name || ''})`, `${fmtDate(r.startDate)} - ${fmtDate(r.endDate)}`] },
  trades: { label: 'Trades', fields: [{ k: 'name', l: 'Trade name', t: 'text' }, { k: 'code', l: 'Code', t: 'text' }], show: (r) => [r.name, r.code] },
  classes: { label: 'Classes', fields: [{ k: 'name', l: 'Class name', t: 'text' }, { k: 'level', l: 'Level (L3, L4, L5)', t: 'text' }, { k: 'trade', l: 'Trade', t: 'ref', from: 'trades', text: 'name' }, { k: 'academicYear', l: 'Academic year', t: 'ref', from: 'years', text: 'name' }], show: (r) => [r.name, `${r.level} - ${r.trade?.name || ''}`] },
  modules: { label: 'Modules', fields: [{ k: 'name', l: 'Module name', t: 'text' }, { k: 'code', l: 'Code', t: 'text' }, { k: 'trade', l: 'Trade', t: 'ref', from: 'trades', text: 'name' }, { k: 'level', l: 'Level', t: 'text' }], show: (r) => [r.name, `${r.code || ''} ${r.level || ''} - ${r.trade?.name || ''}`] },
  outcomes: { label: 'Learning Outcomes', fields: [{ k: 'module', l: 'Module', t: 'ref', from: 'modules', text: 'name' }, { k: 'title', l: 'Learning outcome', t: 'text' }], show: (r) => [r.title, r.module?.name] },
  assignments: { label: 'Trainer Assignments', fields: [{ k: 'trainer', l: 'Trainer', t: 'ref', from: 'trainers', text: 'name' }, { k: 'class', l: 'Class', t: 'ref', from: 'classes', text: 'name' }, { k: 'module', l: 'Module', t: 'ref', from: 'modules', text: 'name' }], show: (r) => [`${r.trainer?.name} - ${r.class?.name}`, r.module?.name] },
};

function Lookup({ name }) { return name; }

function RecordForm({ entity, onClose, onDone }) {
  const cfg = ENTITIES[entity];
  const lists = {
    years: useFetch(() => api.get('/academic/years'), []),
    trades: useFetch(() => api.get('/academic/trades'), []),
    classes: useFetch(() => api.get('/academic/classes'), []),
    modules: useFetch(() => api.get('/academic/modules'), []),
    trainers: useFetch(() => api.get('/users/lookup?role=trainer'), []),
  };
  const [f, setF] = useState({});
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post(`/academic/${entity}`, f); onDone(); } catch (er) { setError(er.message); }
  };
  return (
    <Modal title={`Add - ${cfg.label}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        {cfg.fields.map((fl) => (
          <div key={fl.k}>
            {fl.t === 'bool' ? (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f[fl.k]} onChange={(e) => setF({ ...f, [fl.k]: e.target.checked })} /> {fl.l}</label>
            ) : (
              <>
                <label className="label">{fl.l}</label>
                {fl.t === 'ref' ? (
                  <select required className="input" value={f[fl.k] || ''} onChange={(e) => setF({ ...f, [fl.k]: e.target.value })}>
                    <option value="">Select</option>
                    {(Array.isArray(lists[fl.from].data) ? lists[fl.from].data : []).map((o) => <option key={o._id} value={o._id}>{o[fl.text]}</option>)}
                  </select>
                ) : (
                  <input className="input" type={fl.t === 'date' ? 'date' : 'text'} required={fl.k === 'name' || fl.k === 'title' || fl.k === 'level'} value={f[fl.k] || ''} onChange={(e) => setF({ ...f, [fl.k]: e.target.value })} />
                )}
              </>
            )}
          </div>
        ))}
        <button className="btn-primary w-full">Save</button>
      </form>
    </Modal>
  );
}

export default function Academic() {
  const [entity, setEntity] = useState('classes');
  const cfg = ENTITIES[entity];
  const { data, loading, error, reload } = useFetch(() => api.get(`/academic/${entity}`), [entity]);
  const [add, setAdd] = useState(false);
  const remove = async (r) => { if (window.confirm('Delete this record?')) { await api.del(`/academic/${entity}/${r._id}`); reload(); } };
  return (
    <>
      <PageHeader title="Academic setup" subtitle="Years, terms, trades, classes, modules, learning outcomes and trainer assignments">
        <button className="btn-primary" onClick={() => setAdd(true)}>Add</button>
      </PageHeader>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Object.entries(ENTITIES).map(([k, v]) => (
          <button key={k} onClick={() => setEntity(k)} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${entity === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700'}`}>{v.label}</button>
        ))}
      </div>
      <Alert>{error}</Alert>
      {loading ? <Spinner /> : !data?.length ? <Empty text="Nothing here yet. Use Add to create the first record." /> : (
        <div className="card divide-y divide-ink-100">
          {data.map((r) => {
            const [a, b] = cfg.show(r);
            return (
              <div key={r._id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate font-medium"><Lookup name={a} /></p><p className="truncate text-sm text-ink-500">{b}</p></div>
                <button className="btn-danger" onClick={() => remove(r)}>Delete</button>
              </div>
            );
          })}
        </div>
      )}
      {add && <RecordForm entity={entity} onClose={() => setAdd(false)} onDone={() => { setAdd(false); reload(); }} />}
    </>
  );
}
