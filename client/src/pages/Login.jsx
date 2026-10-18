import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Alert } from '../components/ui';

function Shell({ title, lead, children }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel: the exercise-book page */}
      <aside className="ruled relative hidden overflow-hidden bg-ink-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 lg:pl-16">
        <span aria-hidden="true" className="margin-line absolute inset-y-0 left-10 w-px bg-brand-500" />
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-white p-1.5"><img src="/logo.png" alt="" className="h-full w-full object-contain" /></span>
          <span className="font-serif text-xl font-semibold leading-tight">Groupe Scolaire<br />APACOPE</span>
        </Link>
        <div>
          <p className="max-w-sm font-serif text-3xl font-medium leading-tight">Attendance, results and learning materials in one place.</p>
          <p className="mt-4 max-w-sm text-white/65">Parents, students, trainers and staff sign in with the account the school office created for them.</p>
        </div>
      </aside>

      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" aria-hidden="true" />School website</Link>
          <img src="/logo.png" alt="Groupe Scolaire APACOPE" className="h-10 w-10 object-contain lg:hidden" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl">{title}</h1>
          {lead && <p className="mt-2 text-ink-500">{lead}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); navigate('/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Shell title="Sign in" lead="Use the email and password from the school office.">
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="input py-2.5" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div>
          <div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link className="mb-1 text-[13px] font-medium text-brand-700 hover:underline" to="/forgot-password">Forgot password?</Link></div>
          <input id="password" className="input py-2.5" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const d = await api.post('/auth/forgot-password', { email }).catch((er) => ({ message: er.message }));
    setMsg(d.message); setLink(d.devLink || '');
  };
  return (
    <Shell title="Reset your password" lead="Enter your email and we will send you a link to choose a new password.">
      <Alert kind="ok">{msg}</Alert>
      {link && <p className="mb-4 break-all rounded-md bg-ink-50 p-3 text-xs text-ink-500">Development link: <a className="text-brand-700 underline" href={link}>{link}</a></p>}
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="fp-email">Email</label><input id="fp-email" className="input py-2.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn-primary w-full py-2.5">Send reset link</button>
      </form>
      <p className="mt-6 text-sm"><Link className="font-medium text-brand-700 hover:underline" to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { const d = await api.post(`/auth/reset-password/${token}`, { password }); setMsg(d.message); setError(''); } catch (er) { setError(er.message); }
  };
  return (
    <Shell title="Choose a new password" lead="Use at least 8 characters.">
      <Alert>{error}</Alert><Alert kind="ok">{msg}</Alert>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label" htmlFor="np">New password</label><input id="np" className="input py-2.5" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn-primary w-full py-2.5">Save password</button>
      </form>
      <p className="mt-6 text-sm"><Link className="font-medium text-brand-700 hover:underline" to="/login">Go to sign in</Link></p>
    </Shell>
  );
}
