import { Fragment } from 'react';

/** The report card as it appears on screen and when printed. Used by the DOS page and by learners and parents. */
const TYPE_TINT = { formative: 'text-sky-800', summative: 'text-amber-800', comprehensive: 'text-violet-800' };

function Field({ label, value }) {
  return <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-ink-500">{label}</dt><dd className="truncate font-semibold">{value || '-'}</dd></div>;
}

export default function ReportSheet({ r, comment }) {
  const term = r.term ? `${r.term.name}${r.term.year ? ` - ${r.term.year}` : ''}` : 'All approved marks';
  const text = (comment ?? r.comment ?? '').trim();
  return (
    <article className="rounded-lg border border-ink-200 bg-white print:rounded-none print:border-0" aria-label="Student report card">
      <header className="flex items-center gap-4 border-b-2 border-brand-600 px-5 py-4">
        <img src="/logo.png" alt="" className="h-16 w-16 shrink-0 object-contain" />
        <div><p className="font-serif text-xl font-semibold">Groupe Scolaire APACOPE</p><p className="text-sm text-ink-500">Technical education that gets learners ready for work</p></div>
      </header>

      <div className="px-5 pb-2 pt-4 text-center"><h2 className="text-lg font-bold tracking-wide">STUDENT REPORT CARD</h2><p className="text-sm text-ink-500">{term}</p></div>

      <dl className="mx-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-ink-200 bg-ink-50 p-4 sm:grid-cols-4">
        <Field label="Learner" value={`${r.student.firstName} ${r.student.lastName}`} />
        <Field label="Admission no" value={r.student.admissionNo} />
        <Field label="Class" value={r.class?.name} />
        <Field label="Trade" value={r.class?.trade} />
        <Field label="Gender" value={r.student.gender === 'F' ? 'Female' : r.student.gender === 'M' ? 'Male' : ''} />
        <Field label="Position" value={r.position ? `${r.position} of ${r.outOf}` : ''} />
        <Field label="Attendance" value={r.attendance ? `${r.attendance.percentage}%` : ''} />
        <Field label="Absences" value={r.attendance ? String(r.attendance.absent) : ''} />
      </dl>

      {!r.modules.length ? (
        <p className="px-5 py-10 text-center text-sm text-ink-500">No approved marks have been recorded for this learner in this period.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="bg-ink-900 text-white"><th className="px-3 py-2 text-left font-semibold">Module / assessment</th><th className="px-3 py-2 text-right font-semibold">Marks</th><th className="px-3 py-2 text-right font-semibold">%</th><th className="px-3 py-2 text-center font-semibold">Grade</th><th className="px-3 py-2 text-right font-semibold">Result</th></tr></thead>
              {r.modules.map((m) => (
                <tbody key={m.code || m.module} className="break-inside-avoid">
                  <tr className="bg-ink-100 font-semibold">
                    <td className="px-3 py-2">{m.module}{m.code && <span className="ml-2 text-xs font-normal text-ink-500">{m.code}</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m.total} / {m.max}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.percentage}</td>
                    <td className="px-3 py-2 text-center">{m.grade}</td>
                    <td className={`px-3 py-2 text-right ${m.competent ? 'text-emerald-700' : 'text-brand-700'}`}>{m.competent ? 'Competent' : 'Not yet competent'}</td>
                  </tr>
                  {m.categories.map((c) => (
                    <Fragment key={`${m.module}-${c.type}`}>
                      <tr className="text-xs">
                        <td className={`px-3 pb-1 pt-2 font-semibold uppercase tracking-wide ${TYPE_TINT[c.type] || ''}`}>{c.label}</td>
                        <td className="whitespace-nowrap px-3 pb-1 pt-2 text-right font-semibold tabular-nums text-ink-500">{c.total} / {c.max}</td>
                        <td className="px-3 pb-1 pt-2 text-right font-semibold tabular-nums text-ink-500">{c.percentage}</td>
                        <td colSpan={2} />
                      </tr>
                      {c.items.map((it, i) => (
                        <tr key={`${m.module}-${c.type}-${i}`} className="border-b border-ink-100">
                          <td className="py-1.5 pl-6 pr-3">{it.title}{it.online && <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">Online</span>}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{it.score} / {it.maxScore}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{it.percentage}</td>
                          <td colSpan={2} />
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr><td colSpan={5} className="h-3" /></tr>
                </tbody>
              ))}
            </table>
          </div>

          <section className="mx-5 mt-2 break-inside-avoid">
            <h3 className="mb-2 text-sm font-bold">Assessment summary</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(r.typeTotals || []).map((t) => (
                <div key={t.type} className="rounded-md border border-ink-200 bg-ink-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-ink-500">{t.label}</p>
                  <p className="text-xl font-bold">{t.max ? `${t.percentage}%` : '-'}</p>
                  <p className="text-xs text-ink-500">{t.max ? `${t.total} / ${t.max} marks - ${t.count} assessment${t.count === 1 ? '' : 's'}` : 'None recorded'}</p>
                </div>
              ))}
            </div>
          </section>

          <dl className="mx-5 mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Overall average" value={`${r.average}%`} />
            <Field label="Grade" value={r.grade} />
            <Field label="Remark" value={r.remark} />
            <Field label="Modules competent" value={`${r.competentCount} of ${r.modules.length}`} />
          </dl>
        </>
      )}

      <section className="mx-5 mt-5 break-inside-avoid">
        <h3 className="text-sm font-bold">Comment of the Director of Studies</h3>
        <div className="mt-2 min-h-[64px] whitespace-pre-line rounded-md border border-ink-200 p-3 text-sm">{text || <span className="text-ink-500">No comment has been written yet.</span>}</div>
      </section>

      <div className="mx-5 mt-10 grid grid-cols-3 gap-8 pb-4 text-xs text-ink-500 break-inside-avoid">
        {['Director of Studies', 'Head Teacher', 'Parent / Guardian'].map((l) => <div key={l} className="border-t border-ink-300 pt-1">{l}</div>)}
      </div>
      <p className="px-5 pb-5 text-[11px] text-ink-500">Grading: A 80-100 Excellent | B 70-79 Very good | C 60-69 Good | D 50-59 Competent | E below 50 Not yet competent. A module is competent at 70% or more. Only marks approved by the DOS are shown.</p>
    </article>
  );
}