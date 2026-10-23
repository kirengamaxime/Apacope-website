import { useState } from 'react';
import { api, qs } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { PageHeader, Alert, Spinner, Empty, Modal, Pagination, StatusBadge, Stat, useFetch, fmtDate, fmtMoney, today } from '../components/ui';

function PayForm({ invoice, onClose, onDone }) {
  const balance = invoice.amount - invoice.paid;
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault(); try { await api.post('/finance/payments', { invoiceId: invoice._id, amount: Number(amount), method }); onDone(); } catch (er) { setError(er.message); } };
  return (
    <Modal title={`Receive payment - ${invoice.student?.firstName} ${invoice.student?.lastName}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <p className="mb-3 text-sm text-ink-500">Balance due: <b>{fmtMoney(balance)}</b></p>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Amount (RWF)</label><input type="number" min={1} max={balance} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">Method</label><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="bank">Bank</option><option value="momo">Mobile money</option></select></div>
        <button className="btn-primary w-full">Record payment & issue receipt</button>
      </form>
    </Modal>
  );
}

function EditInvoice({ invoice, onClose, onDone }) {
  const [f, setF] = useState({ description: invoice.description || '', amount: invoice.amount, dueDate: invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : '' });
  const [error, setError] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { await api.put(`/finance/invoices/${invoice._id}`, { ...f, amount: Number(f.amount) }); onDone(); } catch (er) { setError(er.message); } };
  return (
    <Modal title={`Edit invoice - ${invoice.student?.firstName} ${invoice.student?.lastName}`} onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Description</label><input className="input" value={f.description} onChange={up('description')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Amount (RWF)</label><input type="number" min={1} required className="input" value={f.amount} onChange={up('amount')} /></div><div><label className="label">Due date</label><input type="date" className="input" value={f.dueDate} onChange={up('dueDate')} /></div></div>
        <p className="text-xs text-ink-500">Already paid: {fmtMoney(invoice.paid)}. The amount cannot be lower than this.</p>
        <button className="btn-primary w-full">Save changes</button>
      </form>
    </Modal>
  );
}

function BulkInvoice({ onClose, onDone }) {
  const classes = useFetch(() => api.get('/academic/classes'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const [f, setF] = useState({ classId: '', termId: '', amount: '', description: 'School fees', dueDate: today() });
  const [error, setError] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { await api.post('/finance/invoices/bulk', { ...f, amount: Number(f.amount), termId: f.termId || undefined }); onDone(); } catch (er) { setError(er.message); } };
  return (
    <Modal title="Invoice a whole class" onClose={onClose}>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Class</label><select required className="input" value={f.classId} onChange={up('classId')}><option value="">Select</option>{(classes.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className="label">Term</label><select className="input" value={f.termId} onChange={up('termId')}><option value="">-</option>{(terms.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
        <div><label className="label">Description</label><input className="input" value={f.description} onChange={up('description')} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Amount (RWF)</label><input type="number" min={1} required className="input" value={f.amount} onChange={up('amount')} /></div><div><label className="label">Due date</label><input type="date" className="input" value={f.dueDate} onChange={up('dueDate')} /></div></div>
        <button className="btn-primary w-full">Create invoices</button>
      </form>
    </Modal>
  );
}

export default function Finance() {
  const { user, hasRole } = useAuth();
  const { t } = useLang();
  const accountant = hasRole('accountant');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const inv = useFetch(() => api.get(`/finance/invoices${qs({ page, status })}`), [page, status]);
  const pay = useFetch(() => api.get('/finance/payments'), []);
  const sum = useFetch(() => (['accountant', 'headteacher', 'admin'].includes(user.role) ? api.get('/finance/summary') : Promise.resolve(null)), []);
  const [payFor, setPayFor] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [err, setErr] = useState('');
  const refresh = () => { inv.reload(); pay.reload(); sum.reload(); };
  const removeInvoice = async (i) => {
    if (!window.confirm(`Delete this invoice for ${i.student?.firstName} ${i.student?.lastName} (${fmtMoney(i.amount)})?\n\nAll receipts issued for it are deleted too. This cannot be undone.`)) return;
    setErr('');
    try { await api.del(`/finance/invoices/${i._id}`); refresh(); } catch (e) { setErr(e.message); }
  };
  const removePayment = async (p) => {
    if (!window.confirm(`Cancel receipt ${p.receiptNo} (${fmtMoney(p.amount)})? The invoice balance goes back up.`)) return;
    setErr('');
    try { await api.del(`/finance/payments/${p._id}`); refresh(); } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <PageHeader title={t('Fees and finance')} subtitle={t('Invoices, receipts, payments and balances')}>
        {accountant && <button className="btn-primary" onClick={() => setBulk(true)}>Invoice a class</button>}
      </PageHeader>
      {sum.data && <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><Stat label={t('Billed')} value={fmtMoney(sum.data.billed)} /><Stat label={t('Collected')} value={fmtMoney(sum.data.collected)} tone="good" /><Stat label={t('Outstanding')} value={fmtMoney(sum.data.outstanding)} tone="bad" /></div>}
      <Alert>{err}</Alert>
      <div className="card">
        <div className="mb-3 flex items-center justify-between"><h2>{t('Invoices')}</h2>
          <select className="input w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">{t('All')}</option><option value="unpaid">{t('Unpaid')}</option><option value="partial">{t('Partial')}</option><option value="paid">{t('Paid')}</option></select>
        </div>
        {inv.loading ? <Spinner /> : !inv.data?.items?.length ? <Empty text="No invoices." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-ink-200"><th className="th">{t('Student')}</th><th className="th">{t('Description')}</th><th className="th">{t('Billed')}</th><th className="th">{t('Paid')}</th><th className="th">{t('Balance')}</th><th className="th">{t('Status')}</th><th className="th" /></tr></thead>
              <tbody>
                {inv.data.items.map((i) => (
                  <tr key={i._id} className="border-b border-ink-100"><td className="td font-medium">{i.student?.firstName} {i.student?.lastName}</td><td className="td">{i.description}</td><td className="td">{fmtMoney(i.amount)}</td><td className="td">{fmtMoney(i.paid)}</td><td className="td font-semibold">{fmtMoney(i.amount - i.paid)}</td><td className="td"><StatusBadge status={i.status} /></td>
                    <td className="td whitespace-nowrap text-right">{accountant && <>{i.status !== 'paid' && <button className="btn-ghost" onClick={() => setPayFor(i)}>Receive</button>}<button className="btn-ghost" onClick={() => setEditInv(i)}>Edit</button><button className="btn-danger" onClick={() => removeInvoice(i)}>Delete</button></>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={inv.data?.pages} onChange={setPage} />
      </div>
      <div className="card mt-4">
        <h2 className="mb-3">{t('Receipts')}</h2>
        <ul className="divide-y divide-ink-100 text-sm">
          {(pay.data || []).slice(0, 15).map((p) => <li key={p._id} className="flex flex-wrap justify-between gap-2 py-2"><span className="font-medium">{p.receiptNo}</span><span>{p.student?.firstName} {p.student?.lastName}</span><span>{fmtMoney(p.amount)} - {t(p.method)}</span><span className="text-ink-500">{fmtDate(p.createdAt)}</span>{accountant && <button className="btn-danger" onClick={() => removePayment(p)}>Cancel</button>}</li>)}
          {!pay.data?.length && <li className="py-3 text-ink-500">{t('No payments yet.')}</li>}
        </ul>
      </div>
      {payFor && <PayForm invoice={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); refresh(); }} />}
      {editInv && <EditInvoice invoice={editInv} onClose={() => setEditInv(null)} onDone={() => { setEditInv(null); refresh(); }} />}
      {bulk && <BulkInvoice onClose={() => setBulk(false)} onDone={() => { setBulk(false); refresh(); }} />}
    </>
  );
}