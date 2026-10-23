import { useState } from 'react';
import { api, qs } from '../api/client';
import { useLang } from '../context/LanguageContext';
import { PageHeader, Spinner, StatusBadge, Pagination, Stat, useFetch, fmtDate } from '../components/ui';

export default function MyAttendance() {
  const { t } = useLang();
  const [page, setPage] = useState(1);
  const sum = useFetch(() => api.get('/attendance/summary'), []);
  const hist = useFetch(() => api.get(`/attendance${qs({ page, limit: 15 })}`), [page]);
  return (
    <>
      <PageHeader title={t('Attendance')} subtitle={t("This month's summary and full history")} />
      {sum.loading ? <Spinner /> : (sum.data || []).map((s) => (
        <div key={s.student._id} className="mb-4">
          <h2 className="mb-2">{s.student.name}</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label={t('Attendance')} value={`${s.percentage}%`} tone={s.percentage >= 90 ? 'good' : s.percentage >= 75 ? 'warn' : 'bad'} />
            <Stat label={t('Present')} value={s.present} tone="good" /><Stat label={t('Absent')} value={s.absent} tone="bad" />
            <Stat label={t('Late')} value={s.late} tone="warn" /><Stat label={t('Excused')} value={s.excused} />
          </div>
        </div>
      ))}
      <div className="card">
        <h2 className="mb-3">{t('History')}</h2>
        {hist.loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead><tr className="border-b border-ink-200"><th className="th">{t('Date')}</th><th className="th">{t('Student')}</th><th className="th">{t('Session')}</th><th className="th">{t('Status')}</th><th className="th">{t('Note')}</th></tr></thead>
              <tbody>
                {(hist.data?.items || []).map((a) => (
                  <tr key={a._id} className="border-b border-ink-100"><td className="td">{fmtDate(a.date)}</td><td className="td">{a.student?.firstName}</td><td className="td">{t(a.session)}</td><td className="td"><StatusBadge status={a.status} /></td><td className="td text-ink-500">{a.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={hist.data?.pages} onChange={setPage} />
      </div>
    </>
  );
}