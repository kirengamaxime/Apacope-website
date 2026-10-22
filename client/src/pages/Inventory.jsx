import { useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, useFetch, fmtDate } from '../components/ui';

const CATS = ['computer', 'lab', 'tool', 'book', 'other'];
const COND = { good: 'bg-emerald-50 text-emerald-700', fair: 'bg-amber-50 text-amber-700', damaged: 'bg-red-100 text-red-700' };

function ItemForm({ item, onClose, onDone }) {
  const edit = !!item;
  const [f, setF] = useState({ name: item?.name || '', category: item?.category || 'computer', tag: item?.tag || '', quantity: item?.quantity || 1, condition: item?.condition || 'good' });
  const [error, setError] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { const body = { ...f, quantity: Number(f.quantity), tag: f.tag || undefined }; if (edit) await api.put(`/inventory/items/${item._id}`, body); else await api.post('/inventory/items', body); onDone(); } catch (er) { setError(er.message); } };
  return (
    <Modal title={edit ? 'Edit inventory item' : 'Add inventory item'} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label><input className="input" required value={f.name} onChange={up('name')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Category</label><select className="input" value={f.category} onChange={up('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div><div><label className="label">Tag / code</label><input className="input" value={f.tag} onChange={up('tag')} /></div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Quantity</label><input type="number" min={1} className="input" value={f.quantity} onChange={up('quantity')} /></div><div><label className="label">Condition</label><select className="input" value={f.condition} onChange={up('condition')}>{Object.keys(COND).map((c) => <option key={c}>{c}</option>)}</select></div></div>
        <button className="btn-primary w-full">Save</button>
      </form>
    </Modal>
  );
}

function LoanForm({ item, onClose, onDone }) {
  const users = useFetch(() => api.get('/users/lookup'), []);
  const [f, setF] = useState({ borrowerId: '', quantity: 1, dueAt: '' });
  const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault(); try { await api.post('/inventory/loans', { itemId: item._id, ...f, quantity: Number(f.quantity), dueAt: f.dueAt || undefined }); onDone(); } catch (er) { setError(er.message); } };
  return (
    <Modal title={`Lend: ${item.name}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Borrower</label><select required className="input" value={f.borrowerId} onChange={(e) => setF({ ...f, borrowerId: e.target.value })}><option value="">Select</option>{(users.data || []).map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Quantity (max {item.available})</label><input type="number" min={1} max={item.available} className="input" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div><div><label className="label">Due</label><input type="date" className="input" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></div></div>
        <button className="btn-primary w-full">Record loan</button>
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const { hasRole } = useAuth();
  const manage = hasRole('librarian');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const items = useFetch(() => api.get(`/inventory/items${qs({ page, search, category })}`), [page, search, category]);
  const loans = useFetch(() => api.get('/inventory/loans?open=true'), []);
  const [add, setAdd] = useState(null); // null | {} (new) | item (edit)
  const [err, setErr] = useState('');
  const [lend, setLend] = useState(null);
  const refresh = () => { items.reload(); loans.reload(); };
  const removeItem = async (i) => {
    if (!window.confirm(`Delete "${i.name}" from the inventory? Its loan history is deleted too. This cannot be undone.`)) return;
    setErr('');
    try { await api.del(`/inventory/items/${i._id}`); refresh(); } catch (e) { setErr(e.message); }
  };
  const removeLoan = async (l) => {
    if (!window.confirm(`Delete this loan record (${l.item?.name} - ${l.borrower?.name})?`)) return;
    setErr('');
    try { await api.del(`/inventory/loans/${l._id}`); refresh(); } catch (e) { setErr(e.message); }
  };
  const giveBack = async (l) => {
    const damaged = window.confirm('Was the item damaged? OK = yes, Cancel = no');
    const damageNote = damaged ? window.prompt('Describe the damage') || '' : '';
    await api.put(`/inventory/loans/${l._id}/return`, { damaged, damageNote }); refresh();
  };
  return (
    <>
      <PageHeader title="Inventory and library" subtitle="Computers, lab equipment, tools and books">{manage && <button className="btn-primary" onClick={() => setAdd({})}>Add item</button>}</PageHeader>
      <div className="card mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <input className="input" placeholder="Search items..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      <Alert>{err}</Alert>
      {items.loading ? <Spinner /> : !items.data?.items?.length ? <Empty text="No items." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead><tr className="border-b border-ink-200"><th className="th">Item</th><th className="th">Tag</th><th className="th">Category</th><th className="th">Available</th><th className="th">Condition</th><th className="th" /></tr></thead>
            <tbody>
              {items.data.items.map((i) => (
                <tr key={i._id} className="border-b border-ink-100"><td className="td font-medium">{i.name}</td><td className="td">{i.tag}</td><td className="td capitalize">{i.category}</td><td className="td">{i.available}/{i.quantity}</td><td className="td"><span className={`badge ${COND[i.condition]}`}>{i.condition}</span></td>
                  <td className="td whitespace-nowrap text-right">{manage && <><button className="btn-ghost" disabled={!i.available} onClick={() => setLend(i)}>Lend</button><button className="btn-ghost" onClick={() => setAdd(i)}>Edit</button><button className="btn-danger" onClick={() => removeItem(i)}>Delete</button></>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={items.data?.pages} onChange={setPage} />
      <div className="card mt-4">
        <h2 className="mb-3">Open loans</h2>
        <ul className="divide-y divide-ink-100 text-sm">
          {(loans.data || []).map((l) => (
            <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><b>{l.item?.name}</b> x{l.quantity} - {l.borrower?.name}</span>
              <span className="text-ink-500">Borrowed {fmtDate(l.borrowedAt)}{l.dueAt ? `, due ${fmtDate(l.dueAt)}` : ''}</span>
              {manage && <span className="whitespace-nowrap"><button className="btn-ghost" onClick={() => giveBack(l)}>Return</button><button className="btn-danger" onClick={() => removeLoan(l)}>Delete</button></span>}
            </li>
          ))}
          {!loans.data?.length && <li className="py-3 text-ink-500">Nothing is on loan.</li>}
        </ul>
      </div>
      {add && <ItemForm item={add._id ? add : null} onClose={() => setAdd(null)} onDone={() => { setAdd(null); refresh(); }} />}
      {lend && <LoanForm item={lend} onClose={() => setLend(null)} onDone={() => { setLend(null); refresh(); }} />}
    </>
  );
}