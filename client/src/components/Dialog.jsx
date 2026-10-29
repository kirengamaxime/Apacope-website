import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CircleHelp, Info } from 'lucide-react';

/*
 * Professional replacements for the browser's alert(), confirm() and prompt() boxes.
 *
 *   const dialog = useDialog();
 *   if (!(await dialog.confirm({ title: 'Delete invoice?', message: '...', confirmText: 'Delete', danger: true }))) return;
 *   const text = await dialog.prompt({ title: 'New score', label: 'Score', value: '12' });   // string, or null when cancelled
 *   const v = await dialog.form({ title: 'Edit', fields: [{ name: 'title', label: 'Title', value: '' }] }); // object, or null
 *   await dialog.alert({ title: 'Could not save', message: error.message });
 */
const Ctx = createContext(null);

export function useDialog() {
  const d = useContext(Ctx);
  if (!d) throw new Error('useDialog must be used inside <DialogProvider>');
  return d;
}

const asSpec = (o) => (typeof o === 'string' ? { message: o } : o || {});

export function DialogProvider({ children }) {
  const [spec, setSpec] = useState(null);
  const [values, setValues] = useState({});
  const [problem, setProblem] = useState('');
  const resolver = useRef(null);
  const firstField = useRef(null);
  const primary = useRef(null);
  const cancel = useRef(null);

  const open = useCallback((s) => new Promise((resolve) => {
    resolver.current = resolve;
    setProblem('');
    setValues(Object.fromEntries((s.fields || []).map((f) => [f.name, f.value ?? ''])));
    setSpec(s);
  }), []);

  const finish = useCallback((result) => {
    const r = resolver.current;
    resolver.current = null;
    setSpec(null);
    if (r) r(result);
  }, []);

  const api = useMemo(() => ({
    confirm: (o) => open({ kind: 'confirm', ...asSpec(o) }),
    alert: (o) => open({ kind: 'alert', ...asSpec(o) }),
    form: (o) => open({ kind: 'form', ...asSpec(o) }),
    prompt: async (o) => {
      const s = asSpec(o);
      const r = await open({ kind: 'form', ...s, fields: [{ name: 'value', label: s.label, value: s.value, multiline: s.multiline, required: s.required, placeholder: s.placeholder, type: s.type, hint: s.hint }] });
      return r ? r.value : null;
    },
  }), [open]);

  // focus: the first field of a form, otherwise the safe button (Cancel for a dangerous action)
  useEffect(() => {
    if (!spec) return;
    const el = firstField.current || (spec.danger && cancel.current) || primary.current;
    if (el) el.focus();
  }, [spec]);

  const submit = (e) => {
    if (e) e.preventDefault();
    if (spec.kind === 'form') {
      const missing = (spec.fields || []).find((f) => f.required && !String(values[f.name] ?? '').trim());
      if (missing) return setProblem(`Please fill in: ${missing.label}`);
      return finish(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])));
    }
    return finish(true);
  };
  const dismiss = () => finish(spec.kind === 'confirm' ? false : spec.kind === 'alert' ? true : null);

  useEffect(() => {
    if (!spec) return undefined;
    const h = (e) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [spec]);

  const Icon = spec?.danger ? AlertTriangle : spec?.kind === 'alert' ? Info : CircleHelp;
  const tone = spec?.danger ? 'bg-red-100 text-brand-700' : spec?.kind === 'alert' ? 'bg-sky-100 text-sky-800' : 'bg-ink-100 text-ink-700';

  return (
    <Ctx.Provider value={api}>
      {children}
      {spec && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && spec.kind !== 'form' && dismiss()}>
          <form role={spec.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={spec.title || 'Message'} onSubmit={submit}
            className="w-full max-w-md overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex gap-4 p-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base">{spec.title || (spec.kind === 'alert' ? 'Notice' : 'Please confirm')}</h2>
                {spec.message && <p className="mt-1.5 whitespace-pre-line text-sm text-ink-700">{spec.message}</p>}
                {spec.kind === 'form' && (
                  <div className="mt-3 space-y-3">
                    {(spec.fields || []).map((f, i) => (
                      <div key={f.name}>
                        {f.label && <label className="label" htmlFor={`dlg-${f.name}`}>{f.label}{f.required ? '' : ' (optional)'}</label>}
                        {f.multiline ? (
                          <textarea id={`dlg-${f.name}`} ref={i === 0 ? firstField : null} className="input min-h-[90px]" value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                        ) : (
                          <input id={`dlg-${f.name}`} ref={i === 0 ? firstField : null} type={f.type || 'text'} step={f.step} min={f.min} max={f.max} className="input" value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
                        )}
                        {f.hint && <p className="mt-1 text-xs text-ink-500">{f.hint}</p>}
                      </div>
                    ))}
                    {problem && <p className="text-sm font-medium text-brand-700" role="alert">{problem}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-ink-100 bg-ink-50 px-5 py-3 sm:flex-row sm:justify-end">
              {spec.kind !== 'alert' && <button type="button" ref={cancel} className="btn-ghost" onClick={dismiss}>{spec.cancelText || 'Cancel'}</button>}
              <button type="submit" ref={primary} className="btn-primary">{spec.confirmText || (spec.kind === 'alert' ? 'OK' : spec.kind === 'form' ? 'Save' : 'Confirm')}</button>
            </div>
          </form>
        </div>
      )}
    </Ctx.Provider>
  );
}