import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { ROLE_LABEL } from '../components/Layout';
import { PageHeader, Alert } from '../components/ui';

/** Shown instead of the app until a temporary password has been replaced */
export function ForcePasswordChange() {
  const { user, refresh, logout } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (f.newPassword !== f.again) return setError('The two new passwords do not match');
    try { await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword }); await refresh(); } catch (er) { setError(er.message); }
  };
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-lg border border-ink-200 bg-white p-6">
        <h1 className="text-2xl">Choose your own password</h1>
        <p className="text-sm text-ink-500">Welcome, {user.name}. The password you were given is temporary. Set a personal one to continue.</p>
        <Alert>{error}</Alert>
        <div><label className="label">Temporary password</label><input type="password" required autoComplete="current-password" className="input" value={f.currentPassword} onChange={up('currentPassword')} /></div>
        <div><label className="label">New password (min 8)</label><input type="password" minLength={8} required autoComplete="new-password" className="input" value={f.newPassword} onChange={up('newPassword')} /></div>
        <div><label className="label">New password again</label><input type="password" minLength={8} required autoComplete="new-password" className="input" value={f.again} onChange={up('again')} /></div>
        <button className="btn-primary w-full">Save and continue</button>
        <button type="button" className="btn-ghost w-full" onClick={logout}>Log out</button>
      </form>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const { t } = useLang();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setError('');
    try { const d = await api.post('/auth/change-password', f); setMsg(d.message); setF({ currentPassword: '', newPassword: '' }); } catch (er) { setError(er.message); }
  };
  return (
    <>
      <PageHeader title={t('My account')} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card"><h2 className="mb-3">{t('Profile')}</h2>
          <dl className="space-y-2 text-sm"><div><dt className="label">{t('Name')}</dt><dd>{user.name}</dd></div><div><dt className="label">{t('Email')}</dt><dd>{user.email}</dd></div><div><dt className="label">{t('Role')}</dt><dd>{t(ROLE_LABEL[user.role])}</dd></div></dl>
        </div>
        <div className="card"><h2 className="mb-3">{t('Change password')}</h2>
          <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
          <form onSubmit={submit} className="space-y-3">
            <div><label className="label">{t('Current password')}</label><input type="password" required className="input" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></div>
            <div><label className="label">{t('New password (min 8)')}</label><input type="password" minLength={8} required className="input" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></div>
            <button className="btn-primary">{t('Update password')}</button>
          </form>
        </div>
      </div>
    </>
  );
}