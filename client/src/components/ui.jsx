import { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext';
import { formatDate } from '../i18n/dateLocale';
import { Loader2, Inbox, CircleAlert, CircleCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-ink-200 pb-5">
      <div className="min-w-0">
        <h1 className="leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const TONE = { default: 'text-ink-900', good: 'text-emerald-700', warn: 'text-amber-700', bad: 'text-brand-600' };

export function Stat({ label, value, hint, tone = 'default' }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4 sm:p-5">
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <p className={`mt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums sm:text-3xl ${TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** A single bordered band of key figures, separated by hairlines */
export function StatBand({ items }) {
  const odd = items.length % 2 === 1;
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
      style={{ '--n': items.length }}
    >
      {items.map((s, i) => (
        <div key={s.label} className={`bg-white p-4 sm:p-5 ${odd && i === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
          <p className="text-[13px] font-medium text-ink-500">{s.label}</p>
          <p className={`mt-1.5 font-semibold leading-none tracking-tight tabular-nums ${String(s.value).length > 9 ? 'text-xl sm:text-2xl' : 'text-[1.75rem] sm:text-3xl'} ${TONE[s.tone || 'default']}`}>{s.value}</p>
          {s.hint && <p className="mt-2 text-xs text-ink-500">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ text }) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {text || t('Loading')}
    </div>
  );
}

export function Empty({ text }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-ink-500">
      <Inbox className="h-6 w-6 text-ink-300" aria-hidden="true" />
      <p>{t(text || 'Nothing to show yet.')}</p>
    </div>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const isErr = kind === 'error';
  const Icon = isErr ? CircleAlert : CircleCheck;
  return (
    <div role={isErr ? 'alert' : 'status'} className={`mb-4 flex items-start gap-2.5 rounded-md border-l-4 px-3 py-2.5 text-sm ${isErr ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-emerald-600 bg-emerald-50 text-emerald-900'}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  const { t } = useLang();
  if (!pages || pages <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-ink-500">{t('Page {page} of {pages}', { page, pages })}</span>
      <div className="flex gap-2">
        <button className="btn-ghost px-3" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" />{t('Previous')}</button>
        <button className="btn-ghost px-3" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t('Next')}<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </nav>
  );
}

export function Modal({ title, onClose, children }) {
  const { t } = useLang();
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:max-w-lg sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
          <h2>{title}</h2>
          <button className="rounded p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900" onClick={onClose} aria-label={t('Close')}><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const STATUS = {
  Normal: ['bg-emerald-50 text-emerald-800', 'bg-emerald-600'],
  'Follow-up': ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  'High Priority': ['bg-orange-50 text-orange-800', 'bg-orange-500'],
  Urgent: ['bg-brand-50 text-brand-700', 'bg-brand-600'],
  present: ['bg-emerald-50 text-emerald-800', 'bg-emerald-600'],
  absent: ['bg-brand-50 text-brand-700', 'bg-brand-600'],
  late: ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  excused: ['bg-sky-50 text-sky-800', 'bg-sky-600'],
  paid: ['bg-emerald-50 text-emerald-800', 'bg-emerald-600'],
  partial: ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  unpaid: ['bg-brand-50 text-brand-700', 'bg-brand-600'],
  active: ['bg-emerald-50 text-emerald-800', 'bg-emerald-600'],
  graduated: ['bg-sky-50 text-sky-800', 'bg-sky-600'],
  transferred: ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  dropped: ['bg-brand-50 text-brand-700', 'bg-brand-600'],
};
export function StatusBadge({ status }) {
  const { t } = useLang();
  const [box, dot] = STATUS[status] || ['bg-ink-100 text-ink-700', 'bg-ink-500'];
  return <span className={`badge ${box}`}><i className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />{t(status)}</span>;
}

/**
 * Class x weekday heatmap. The percentage is printed in every cell, so colour is
 * never the only signal. Greens/ambers/reds are muted tints with dark text.
 */
export function Heatmap({ days, grid, good = 90, warn = 75 }) {
  const tone = (v) => {
    if (v === null) return 'bg-ink-50 text-ink-300';
    if (v >= good) return 'bg-[#cfe9db] text-[#124a2b]';
    if (v >= warn) return 'bg-[#f6e7b4] text-[#5a4210]';
    return 'bg-[#f3c6c3] text-[#7a1a18]';
  };
  if (!grid?.length) return <Empty text="No attendance recorded yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-separate border-spacing-[3px] text-center text-xs sm:text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs font-semibold text-ink-500">Class</th>
            {days.map((d) => <th key={d} className="py-1 text-xs font-semibold text-ink-500">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row.className}>
              <td className="whitespace-nowrap px-1 text-left font-medium sm:px-2">{row.className}</td>
              {row.days.map((v, i) => (
                <td key={i} className={`rounded py-2.5 font-semibold tabular-nums ${tone(v)}`} title={v === null ? 'No data' : `${v}%`}>
                  {v === null ? '-' : `${Math.round(v)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#cfe9db]" />{good}% and above</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#f6e7b4]" />{warn}% to {good - 1}%</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#f3c6c3]" />Below {warn}%</span>
      </div>
    </div>
  );
}

/** Small hook for loading data with loading/error state */
export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn()
      .then((d) => { if (live) { setData(d); setError(''); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1), setData };
}

// The date language follows the language the user picked (set by LanguageProvider)
export const fmtDate = (d) => (d ? formatDate(d) : '');
export const fmtMoney = (n) => `${Number(n || 0).toLocaleString('en-US')} RWF`;
export const today = () => new Date().toISOString().slice(0, 10);