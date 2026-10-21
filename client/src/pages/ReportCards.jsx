import { useEffect, useState } from 'react';
import { api, download, qs } from '../api/client';
import { PageHeader, Alert, Spinner, Empty, useFetch } from '../components/ui';

export default function ReportCards() {
  const classes = useFetch(() => api.get('/academic/classes'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const list = useFetch(() => (classId ? api.get(`/report-cards/class/${classId}${qs({ termId })}`) : Promise.resolve(null)), [classId, termId]);
  const rep = useFetch(() => (studentId ? api.get(`/report-cards/${studentId}${qs({ termId })}`) : Promise.resolve(null)), [studentId, termId]);

  useEffect(() => { setStudentId(''); }, [classId]);
  // Show the saved comment, or the suggested one as a starting draft
  useEffect(() => { if (rep.data) { setComment(rep.data.comment || rep.data.suggestedComment || ''); setMsg(''); } }, [rep.data]);

  const save = async () => {
    setError(''); setMsg(''); setBusy('save');
    try { await api.put(`/report-cards/${studentId}/comment`, { termId: termId || null, comment }); setMsg('Comment saved. It will appear on the report card.'); list.reload(); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const pdf = async (url, name, key) => {
    setError(''); setBusy(key);
    try { await download(`${url}${qs({ termId })}`, name); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const r = rep.data;
  const students = list.data?.students || [];
  return (
    <>
      <PageHeader title="Report cards" subtitle="Build each learner's report from the recorded marks, add your comment, and print it as a PDF">
        {classId && students.length > 0 && <button className="btn-ghost" disabled={!!busy} onClick={() => pdf(`/report-cards/class/${classId}/pdf`, 'class-report-cards.pdf', 'class')}>{busy === 'class' ? 'Preparing...' : 'Download whole class (PDF)'}</button>}
      </PageHeader>
      <Alert>{error}</Alert>

      <div className="card mb-5 grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="rc-class">Class</label>
          <select id="rc-class" className="input" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Choose a class</option>{(classes.data || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label className="label" htmlFor="rc-term">Term</label>
          <select id="rc-term" className="input" value={termId} onChange={(e) => setTermId(e.target.value)}><option value="">All recorded marks</option>{(terms.data || []).map((t) => <option key={t._id} value={t._id}>{t.academicYear?.name ? `${t.academicYear.name} - ` : ''}{t.name}</option>)}</select></div>
      </div>

      {!classId ? <Empty text="Choose a class to see its learners." /> : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-ink-200 bg-white">
            <header className="border-b border-ink-100 px-4 py-3"><h2>Learners</h2>{list.data && <p className="text-[13px] text-ink-500">{students.length} learners, {list.data.ranked} with marks</p>}</header>
            {list.loading ? <Spinner /> : !students.length ? <Empty text="No active learners in this class." /> : (
              <ul className="max-h-[70vh] divide-y divide-ink-100 overflow-y-auto">
                {students.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setStudentId(s.id)} className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-ink-50 ${studentId === s.id ? 'bg-ink-50' : ''}`}>
                      <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="text-xs text-ink-500">{s.modules ? `${s.average}% - Grade ${s.grade}${s.position ? ` - ${s.position} of ${list.data.ranked}` : ''}` : 'No marks yet'}</span></span>
                      {s.hasComment && <span className="badge bg-emerald-50 text-emerald-700">Commented</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-w-0">
            {!studentId ? <div className="rounded-lg border border-dashed border-ink-200 bg-white"><Empty text="Choose a learner to see the report." /></div> : rep.loading || !r ? <Spinner /> : (
              <div className="space-y-5">
                <div className="rounded-lg border border-ink-200 bg-white">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
                    <div><h2>{r.student.firstName} {r.student.lastName}</h2><p className="text-sm text-ink-500">{r.student.admissionNo} - {r.class?.name}{r.class?.trade ? ` - ${r.class.trade}` : ''}{r.term ? ` - ${r.term.name}${r.term.year ? ` ${r.term.year}` : ''}` : ''}</p></div>
                    <button className="btn-primary" disabled={!!busy} onClick={() => pdf(`/report-cards/${studentId}/pdf`, 'report-card.pdf', 'one')}>{busy === 'one' ? 'Preparing...' : 'Download PDF'}</button>
                  </header>
                  {!r.modules.length ? <Empty text="No marks have been recorded for this learner yet." /> : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px]">
                          <thead><tr className="border-b border-ink-200"><th className="th">Module</th><th className="th text-right">Marks</th><th className="th text-right">%</th><th className="th">Grade</th><th className="th">Result</th></tr></thead>
                          <tbody>
                            {r.modules.map((m) => (
                              <tr key={m.code || m.module} className="border-b border-ink-100">
                                <td className="td"><span className="font-medium">{m.module}</span>{m.code && <span className="ml-2 text-xs text-ink-500">{m.code}</span>}</td>
                                <td className="td whitespace-nowrap text-right tabular-nums">{m.total} / {m.max}</td>
                                <td className="td text-right tabular-nums">{m.percentage}</td>
                                <td className="td">{m.grade}</td>
                                <td className="td"><span className={`badge ${m.competent ? 'bg-emerald-50 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{m.competent ? 'Competent' : 'Not yet competent'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <dl className="grid grid-cols-2 gap-px border-t border-ink-200 bg-ink-200 sm:grid-cols-4">
                        {[['Average', `${r.average}%`], ['Grade', `${r.grade} - ${r.remark}`], ['Position', r.position ? `${r.position} of ${r.outOf}` : '-'], ['Attendance', r.attendance ? `${r.attendance.percentage}%` : 'Choose a term']].map(([k, v]) => (
                          <div key={k} className="bg-white px-4 py-3"><dt className="text-[13px] text-ink-500">{k}</dt><dd className="font-semibold">{v}</dd></div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>

                <div className="rounded-lg border border-ink-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2>Comment of the Director of Studies</h2>
                    {r.suggestedComment && <button className="btn-ghost" onClick={() => setComment(r.suggestedComment)}>Use suggested comment</button>}</div>
                  <p className="mt-1 text-sm text-ink-500">A first draft is written from the marks. Edit it freely, then save.</p>
                  <textarea className="input mt-3" rows={5} maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setMsg(''); }} aria-label="Director of Studies comment" />
                  <div className="mt-1 text-right text-xs text-ink-500">{comment.length} / 1000</div>
                  <Alert kind="ok">{msg}</Alert>
                  <button className="btn-primary" disabled={busy === 'save'} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save comment'}</button>
                  <p className="mt-3 text-[13px] text-ink-500">Save before downloading. A learner without a saved comment gets the suggested one in the PDF.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}