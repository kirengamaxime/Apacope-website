import { useEffect, useState } from 'react';
import { api, download, qs } from '../api/client';
import { useLang } from '../context/LanguageContext';
import { PageHeader, Alert, Spinner, Empty, useFetch } from '../components/ui';
import ReportSheet from '../components/ReportSheet';

/** A learner's (or a parent's child's) own report card for a chosen term, ready to print */
export default function MyReport() {
  const { t } = useLang();
  const kids = useFetch(() => api.get('/report-cards/mine/students'), []);
  const terms = useFetch(() => api.get('/academic/terms'), []);
  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = kids.data || [];

  useEffect(() => { if (!studentId && list.length) setStudentId(list[0].id); }, [list, studentId]);
  useEffect(() => { if (!terms.data?.length || termId) return; setTermId((terms.data.find((x) => x.current) || terms.data[0])._id); }, [terms.data, termId]);

  const rep = useFetch(() => (studentId && termId ? api.get(`/report-cards/mine/${studentId}${qs({ termId })}`) : Promise.resolve(null)), [studentId, termId]);
  const pdf = async () => {
    setError(''); setBusy(true);
    try { await download(`/report-cards/mine/${studentId}/pdf${qs({ termId })}`, 'report-card.pdf'); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={t('Report card')} subtitle={t('Your marks for the term, grouped by type of assessment')}>
          {list.length > 1 && (
            <select className="input w-56" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Learner">
              {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select className="input w-56" value={termId} onChange={(e) => setTermId(e.target.value)} aria-label="Term">
            {(terms.data || []).map((x) => <option key={x._id} value={x._id}>{x.academicYear?.name ? `${x.academicYear.name} - ` : ''}{x.name}</option>)}
          </select>
        </PageHeader>
        <Alert>{error || kids.error || rep.error}</Alert>
      </div>
      {kids.loading || rep.loading ? <Spinner /> : !list.length ? <Empty text={t('No learner is linked to this account.')} /> : !rep.data ? <Empty text={t('Choose a term to see the report card.')} /> : (
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm text-ink-500">{t('Only marks approved by the DOS are shown.')}</p>
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => window.print()}>{t('Print')}</button><button className="btn-primary" disabled={busy} onClick={pdf}>{busy ? '...' : t('Download PDF')}</button></div>
          </div>
          <ReportSheet r={rep.data} />
        </div>
      )}
    </>
  );
}