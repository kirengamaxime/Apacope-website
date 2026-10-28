import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { api } from '../api/client';
import { useLang } from '../context/LanguageContext';
import { Spinner, useFetch } from './ui';

const NAVY = '#1f4166';
const GRID = '#dce1e8';
const MUTED = '#5b6a7c';

const TREND = {
  up: ['Improving', 'bg-emerald-50 text-emerald-700', '\u2191'],
  down: ['Declining', 'bg-red-100 text-red-700', '\u2193'],
  steady: ['Steady', 'bg-ink-100 text-ink-700', '\u2192'],
};

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm shadow">
      <p className="font-semibold">{p.label}</p>
      <p>Average {p.average}% - Grade {p.grade}</p>
      {['formative', 'summative', 'comprehensive'].map((k) => p.types?.[k] != null && <p key={k} className="text-xs capitalize text-ink-500">{k}: {p.types[k]}%</p>)}
    </div>
  );
}

const delta = (cur, prev) => (cur == null || prev == null ? null : Math.round((cur - prev) * 10) / 10);

/** A learner's average term by term, with the change from one term to the next, per module too */
export default function ProgressChart({ studentId }) {
  const { t } = useLang();
  const { data, loading } = useFetch(() => (studentId ? api.get(`/report-cards/progress/${studentId}`) : Promise.resolve(null)), [studentId]);
  if (loading) return <Spinner />;
  if (!data || !data.points.length) return null;
  const { points, modules, change, trend } = data;
  const [label, cls, arrow] = TREND[trend] || [];

  return (
    <section className="card mb-4" aria-label={t('Progress over the terms')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h2>{t('Progress over the terms')}</h2><p className="text-sm text-ink-500">{t('Average of the marks approved by the DOS in each term. The dashed line is the competency level (70%).')}</p></div>
        {trend && <span className={`badge ${cls}`}>{arrow} {t(label)} ({change > 0 ? '+' : ''}{change} {t('points since the last term')})</span>}
      </div>

      {points.length < 2 ? (
        <p className="mt-3 rounded-md bg-ink-50 p-3 text-sm text-ink-700">{t('Only one term has marks so far, so there is nothing to compare yet.')} {points[0].label}: {points[0].average}% (Grade {points[0].grade}).</p>
      ) : (
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ left: -14, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" padding={{ left: 40, right: 40 }} tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 70, 100]} tick={{ fontSize: 12, fill: MUTED }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={70} stroke={MUTED} strokeDasharray="4 4" />
              <Tooltip content={<Tip />} cursor={{ stroke: MUTED, strokeDasharray: '3 3' }} />
              <Line type="monotone" isAnimationActive={false} dataKey="average" stroke={NAVY} strokeWidth={2.5} dot={{ r: 4, fill: NAVY, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: NAVY }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead><tr className="border-b border-ink-200"><th className="th">{t('Module')}</th>{points.map((p) => <th key={p.termId} className="th text-right">{p.label}</th>)}{points.length > 1 && <th className="th text-right">{t('Change')}</th>}</tr></thead>
          <tbody>
            {modules.map((name) => {
              const vals = points.map((p) => p.modules.find((m) => m.module === name)?.percentage ?? null);
              const seen = vals.filter((v) => v !== null);
              const d = seen.length > 1 ? delta(seen[seen.length - 1], seen[seen.length - 2]) : null;
              return (
                <tr key={name} className="border-b border-ink-100">
                  <td className="td font-medium">{name}</td>
                  {vals.map((v, i) => <td key={points[i].termId} className="td text-right tabular-nums">{v === null ? '-' : `${v}%`}</td>)}
                  {points.length > 1 && <td className={`td text-right font-semibold tabular-nums ${d > 0 ? 'text-emerald-700' : d < 0 ? 'text-brand-700' : 'text-ink-500'}`}>{d === null ? '-' : `${d > 0 ? '\u2191 +' : d < 0 ? '\u2193 ' : '\u2192 '}${d}`}</td>}
                </tr>
              );
            })}
            <tr className="bg-ink-50 font-semibold">
              <td className="td">{t('Overall average')}</td>
              {points.map((p) => <td key={p.termId} className="td text-right tabular-nums">{p.average}%</td>)}
              {points.length > 1 && <td className="td text-right tabular-nums">{change === null ? '-' : `${change > 0 ? '\u2191 +' : change < 0 ? '\u2193 ' : '\u2192 '}${change}`}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}