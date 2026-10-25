import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Alert, Spinner, useFetch, fmtDate } from '../components/ui';
import { MarksPill, isLate, TYPE_LABEL } from './Assignments';

const optionText = (q, v) => (v === undefined || v === '' ? '' : q.options?.[Number(v)] ?? '');

/* ================================================================ learner */
function LearnerView({ data, reload }) {
  const { assignment: a, mine, points } = data;
  const lookup = new Map((mine.answers || []).map((x) => [String(x.question), x.answer]));
  const [answers, setAnswers] = useState(() => Object.fromEntries(a.questions.map((q) => [q._id, lookup.get(String(q._id)) ?? ''])));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false); // the learner presses "See my marks" to look at them
  const submitted = mine.status === 'submitted';
  const closed = !submitted && (a.marksStatus !== 'open' || isLate(a));
  const payload = () => a.questions.map((q) => ({ question: q._id, answer: answers[q._id] ?? '' }));
  const answered = a.questions.filter((q) => String(answers[q._id] ?? '').trim() !== '').length;

  const save = async (quiet) => {
    try { await api.put(`/online-assignments/${a._id}/answers`, { answers: payload() }); setDirty(false); setSaved(`Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); }
    catch (e) { if (!quiet) setError(e.message); }
  };
  // keep the work safe: save a few seconds after the learner stops typing
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || submitted) return undefined;
    const t = setTimeout(() => saveRef.current(true), 3000);
    return () => clearTimeout(t);
  }, [answers, dirty, submitted]);

  const change = (qid, v) => { setAnswers({ ...answers, [qid]: v }); setDirty(true); setSaved(''); };
  const send = async () => {
    const left = a.questions.length - answered;
    if (!window.confirm(`Send this assignment to your trainer?${left ? `\n\n${left} question${left === 1 ? ' is' : 's are'} still empty.` : ''}\n\nYou cannot change your answers after you send.`)) return;
    setError(''); setBusy(true);
    try { await api.post(`/online-assignments/${a._id}/submit`, { answers: payload() }); reload(); } catch (e) { setError(e.message); setBusy(false); }
  };

  const scoreOf = (qid) => (mine.scores || []).find((s) => String(s.question) === String(qid));
  const shown = mine.marksReleased && reveal;
  const pct = shown && points ? Math.round((mine.total / points) * 1000) / 10 : null;

  return (
    <>
      <PageHeader title={a.title} subtitle={`${a.module?.name} - ${a.trainer?.name} - ${TYPE_LABEL[a.type] || 'Formative'}${a.dueDate ? ` - due ${fmtDate(a.dueDate)}` : ''}`}>
        <Link className="btn-ghost" to="/assignments">All assignments</Link>
      </PageHeader>
      <Alert>{error}</Alert>
      <div className="mx-auto max-w-3xl space-y-4">
        {mine.marksReleased && !reveal && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-emerald-200 bg-emerald-50/50">
            <p className="text-sm text-ink-700">{mine.status === 'submitted' ? 'Your assignment has been marked.' : 'Your marks are ready.'}</p>
            <button className="btn-primary" onClick={() => setReveal(true)}>See my marks</button>
          </div>
        )}
        {shown && (
          <div className="card flex flex-wrap items-center gap-6 border-emerald-200 bg-emerald-50/50">
            <div><p className="label">Your marks</p><p className="text-3xl font-bold">{mine.total}/{points}</p></div>
            <div><p className="label">Percentage</p><p className="text-3xl font-bold text-brand-600">{pct}%</p></div>
            {mine.feedback && <p className="min-w-[200px] flex-1 text-sm text-ink-700"><b>Trainer's feedback:</b> {mine.feedback}</p>}
          </div>
        )}
        {submitted && !mine.marksReleased && <Alert kind="ok">{`You sent this assignment on ${fmtDate(mine.submittedAt)}. Your marks will appear here as soon as your trainer has marked it.`}</Alert>}
        {closed && <Alert>{a.marksStatus !== 'open' ? 'This assignment is closed.' : 'The deadline has passed. Ask your trainer if you still need to send it.'}</Alert>}
        {a.instructions && <div className="card text-sm text-ink-700"><p className="label">Instructions</p><p className="whitespace-pre-line">{a.instructions}</p></div>}

        {a.questions.map((q, i) => {
          const s = scoreOf(q._id);
          const mineAnswer = answers[q._id] ?? '';
          return (
            <div key={q._id} className="card">
              <div className="mb-2 flex items-start justify-between gap-3"><p className="font-semibold">{i + 1}. <span className="whitespace-pre-line font-medium">{q.text}</span></p><span className="shrink-0 text-sm text-ink-500">{shown ? `${s?.score ?? 0}/${q.points}` : `${q.points} pt${q.points === 1 ? '' : 's'}`}</span></div>
              {q.type === 'choice' ? (
                <ul className="space-y-1.5">
                  {q.options.map((o, k) => {
                    const chosen = String(mineAnswer) === String(k);
                    const right = shown && q.correct === k;
                    return (
                      <li key={k}>
                        <label className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${right ? 'border-emerald-500 bg-emerald-50' : chosen && shown ? 'border-red-300 bg-red-50' : chosen ? 'border-brand-600 bg-brand-50' : 'border-ink-200'} ${submitted || closed ? '' : 'cursor-pointer hover:bg-ink-50'}`}>
                          <input type="radio" name={`q-${q._id}`} checked={chosen} disabled={submitted || closed} onChange={() => change(q._id, String(k))} />{o}
                          {right && <span className="ml-auto text-xs font-semibold text-emerald-700">Correct answer</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <textarea className="input min-h-[120px]" value={mineAnswer} disabled={submitted || closed} onChange={(e) => change(q._id, e.target.value)} placeholder={submitted ? '' : 'Type your answer here'} />
              )}
              {shown && s?.comment && <p className="mt-2 text-sm text-ink-700"><b>Comment:</b> {s.comment}</p>}
            </div>
          );
        })}

        {!submitted && !closed && (
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
            <span className="text-sm text-ink-500">{answered}/{a.questions.length} answered{saved ? ` - ${saved}` : dirty ? ' - saving...' : ''}</span>
            <div className="ml-auto flex gap-2"><button className="btn-ghost" disabled={busy || !dirty} onClick={() => save(false)}>Save progress</button><button className="btn-primary" disabled={busy} onClick={send}>Send to trainer</button></div>
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================== staff */
/** Marks one learner's answers. readOnly for the DOS and once the marks are with the DOS. */
function MarkPanel({ a, row, readOnly, onSaved, onClose }) {
  const sub = row.sub;
  const given = new Map((sub.answers || []).map((x) => [String(x.question), x.answer]));
  const found = new Map((sub.scores || []).map((s) => [String(s.question), s]));
  const [scores, setScores] = useState(() => Object.fromEntries(a.questions.map((q) => [q._id, String(found.get(String(q._id))?.score ?? 0)])));
  const [comments, setComments] = useState(() => Object.fromEntries(a.questions.map((q) => [q._id, found.get(String(q._id))?.comment || ''])));
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = a.questions.reduce((t, q) => t + (Number(scores[q._id]) || 0), 0);
  const save = async () => {
    setError('');
    for (const q of a.questions) { const n = Number(scores[q._id]); if (Number.isNaN(n) || n < 0 || n > q.points) return setError(`Question scores must be between 0 and the question's points.`); }
    setBusy(true);
    try {
      await api.put(`/online-assignments/${a._id}/submissions/${row.student._id}/mark`, { scores: a.questions.map((q) => ({ question: q._id, score: Number(scores[q._id]), comment: comments[q._id] })), feedback });
      onSaved();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div className="card mt-4 border-brand-600/40" id="mark-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2>{row.student.lastName} {row.student.firstName} <span className="text-sm font-normal text-ink-500">{row.student.admissionNo}</span></h2>
        <div className="flex items-center gap-3"><span className="text-sm">Total: <b>{Math.round(total * 100) / 100}/{a.questions.reduce((t, q) => t + q.points, 0)}</b></span><button className="btn-ghost" onClick={onClose}>Close</button></div>
      </div>
      <Alert>{error}</Alert>
      {!readOnly && <p className="mb-3 rounded-md bg-sky-50 p-2 text-sm text-sky-900">Multiple-choice answers are already marked for you. Check the written answers, then press <b>Save marks</b>. The learner can see the marks as soon as you save.</p>}
      <div className="space-y-4">
        {a.questions.map((q, i) => {
          const ans = given.get(String(q._id));
          const auto = q.type === 'choice';
          return (
            <div key={q._id} className="rounded-md border border-ink-200 p-3">
              <p className="text-sm font-semibold">{i + 1}. {q.text}</p>
              <div className="mt-2 whitespace-pre-line rounded bg-ink-50 p-2 text-sm">
                {auto ? (ans === undefined || ans === '' ? <span className="text-ink-500">No answer</span> : optionText(q, ans)) : (ans?.trim() ? ans : <span className="text-ink-500">No answer</span>)}
              </div>
              {auto && <p className="mt-1 text-xs text-ink-500">Correct answer: <b className="text-emerald-700">{q.options[q.correct]}</b> (marked automatically, you can still change the score)</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm">Score <input type="number" min={0} max={q.points} step={0.5} className="input w-24 py-1.5" value={scores[q._id]} disabled={readOnly} onChange={(e) => setScores({ ...scores, [q._id]: e.target.value })} /> / {q.points}</label>
                {!readOnly && !auto && <button type="button" className="btn-ghost py-1" onClick={() => setScores({ ...scores, [q._id]: String(q.points) })}>Full marks</button>}
                <input className="input min-w-[200px] flex-1 py-1.5" value={comments[q._id]} disabled={readOnly} placeholder={readOnly ? '' : 'Comment for the learner (optional)'} onChange={(e) => setComments({ ...comments, [q._id]: e.target.value })} />
              </div>
            </div>
          );
        })}
        <div><label className="label">Overall feedback (optional)</label><textarea className="input min-h-[70px]" value={feedback} disabled={readOnly} onChange={(e) => setFeedback(e.target.value)} /></div>
        {!readOnly && <button className="btn-primary" disabled={busy} onClick={save}>Save marks</button>}
      </div>
    </div>
  );
}

function rowState(row) {
  const s = row.sub;
  if (!s) return ['Not started', 'bg-ink-100 text-ink-700'];
  if (s.status !== 'submitted') return ['In progress', 'bg-amber-50 text-amber-800'];
  return s.marked ? ['Marked', 'bg-emerald-50 text-emerald-700'] : ['Waiting to be marked', 'bg-sky-50 text-sky-800'];
}

function StaffView({ data, reload }) {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const { assignment: a, points } = data;
  const trainer = user.role === 'trainer' && String(a.trainer?._id) === String(user.id || user._id); // the login sends `id`
  const dos = hasRole('dos');
  const subs = useFetch(() => api.get(`/online-assignments/${a._id}/submissions`), [a._id, a.marksStatus]);
  const [openId, setOpenId] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const rows = subs.data?.rows || [];
  const sent = rows.filter((r) => r.sub?.status === 'submitted');
  const unmarked = sent.filter((r) => !r.sub.marked).length;
  const locked = ['pending', 'approved'].includes(a.marksStatus);
  const open = rows.find((r) => r.student._id === openId);

  useEffect(() => { if (openId) document.getElementById('mark-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [openId]);

  const act = async (what, body) => {
    setError(''); setBusy(what);
    try { await api.post(`/online-assignments/${a._id}/${what}`, body); setComment(''); setBusy(''); reload(); } catch (e) { setError(e.message); setBusy(''); }
  };
  const sendToDos = () => {
    if (window.confirm(`Send the marks of ${sent.length} learner${sent.length === 1 ? '' : 's'} to the DOS?\n\nYou cannot change them afterwards unless the DOS sends them back.`)) act('send');
  };
  const removeIt = async () => {
    if (!window.confirm(`Delete "${a.title}" and every answer in it? This cannot be undone.`)) return;
    try { await api.del(`/online-assignments/${a._id}`); navigate('/assignments'); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <PageHeader title={a.title} subtitle={`${a.class?.name} - ${a.module?.name} - ${TYPE_LABEL[a.type] || 'Formative'}${a.term ? ` - ${a.term.name}` : ''} - ${a.questions.length} questions, ${points} points${a.dueDate ? ` - due ${fmtDate(a.dueDate)}` : ''}`}>
        <MarksPill status={a.marksStatus} />
        <Link className="btn-ghost" to="/assignments">Back</Link>
        {trainer && !locked && <><Link className="btn-ghost" to={`/assignments/${a._id}/edit`}>Edit</Link><button className="btn-danger" onClick={removeIt}>Delete</button></>}
      </PageHeader>
      <Alert>{error || subs.error}</Alert>
      {a.reviewComment && <Alert kind={a.marksStatus === 'returned' ? 'error' : 'ok'}>{`DOS note: ${a.reviewComment}`}</Alert>}
      {a.status === 'draft' && <Alert>This assignment is a draft. Learners cannot see it yet. Press Edit, then "Save and publish".</Alert>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead><tr className="border-b border-ink-200"><th className="th">Learner</th><th className="th">Progress</th><th className="th">Sent on</th><th className="th">Marks</th><th className="th" /></tr></thead>
          <tbody>
            {subs.loading ? <tr><td colSpan={5}><Spinner /></td></tr> : rows.map((r) => {
              const [label, cls] = rowState(r);
              return (
                <tr key={r.student._id} className="border-b border-ink-100">
                  <td className="td font-medium">{r.student.lastName} {r.student.firstName}<span className="block text-xs font-normal text-ink-500">{r.student.admissionNo}</span></td>
                  <td className="td"><span className={`badge ${cls}`}>{label}</span></td>
                  <td className="td text-ink-500">{r.sub?.submittedAt ? fmtDate(r.sub.submittedAt) : '-'}</td>
                  <td className="td font-semibold">{r.sub?.marked ? `${r.sub.total}/${points}` : '-'}</td>
                  <td className="td text-right">{r.sub?.status === 'submitted' && <button className="btn-ghost" onClick={() => setOpenId(r.student._id === openId ? '' : r.student._id)}>{trainer && !locked ? (r.sub.marked ? 'Review marks' : 'Mark') : 'View'}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <MarkPanel key={open.student._id + String(open.sub.updatedAt)} a={a} row={open} readOnly={!(trainer && !locked)} onClose={() => setOpenId('')} onSaved={() => { setOpenId(''); subs.reload(); }} />}

      {trainer && !locked && (
        <div className="card mt-4 flex flex-wrap items-center gap-3">
          <p className="min-w-[220px] flex-1 text-sm text-ink-700">
            {!sent.length ? 'No learner has sent the assignment yet.' : unmarked ? `${unmarked} of ${sent.length} sent assignment${sent.length === 1 ? ' is' : 's are'} still to be marked.` : `All ${sent.length} sent assignment${sent.length === 1 ? ' is' : 's are'} marked.`}
            {' '}Learners who did not send anything are not given a mark. Send the marks to the DOS so they are recorded in Results.
          </p>
          <button className="btn-primary" disabled={!sent.length || unmarked > 0 || !!busy} onClick={sendToDos}>{a.marksStatus === 'returned' ? 'Send corrected marks to the DOS' : 'Send marks to the DOS'}</button>
        </div>
      )}
      {trainer && a.marksStatus === 'pending' && <Alert kind="ok">The marks are with the DOS. Learners can already see their marks; the DOS approval records them in Results.</Alert>}
      {trainer && a.marksStatus === 'approved' && <Alert kind="ok">{`The DOS approved these marks. They are recorded in Results as a ${TYPE_LABEL[a.type] || 'Formative'} assessment.`}</Alert>}

      {dos && ['pending', 'approved'].includes(a.marksStatus) && (
        <div className="card mt-4 space-y-3">
          <div><label className="label">Note to the trainer {a.marksStatus === 'pending' ? '(required only when returning)' : '(required to reopen)'}</label>
            <textarea className="input min-h-[70px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: Question 3 scores look too low, please check." /></div>
          <div className="flex gap-2">
            {a.marksStatus === 'pending' && <button className="btn-primary flex-1" disabled={!!busy} onClick={() => act('approve', { comment })}>Approve marks</button>}
            <button className="btn-danger flex-1" disabled={!!busy} onClick={() => (comment.trim() ? act('return', { comment }) : setError('Write a short reason so the trainer knows what to correct.'))}>{a.marksStatus === 'approved' ? 'Reopen for correction' : 'Return to trainer'}</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AssignmentDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => api.get(`/online-assignments/${id}`), [id]);
  if (loading) return <Spinner />;
  if (error || !data) return <><PageHeader title="Assignment" /><Alert>{error || 'Not found'}</Alert><Link className="btn-ghost" to="/assignments">Back to assignments</Link></>;
  return data.role === 'student' ? <LearnerView key={id} data={data} reload={reload} /> : <StaffView key={id} data={data} reload={reload} />;
}