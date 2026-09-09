import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import Wordmark from '@/components/Wordmark';

export default function Login() {
  const { user, login } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState('alice@talkio.dev');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('error.login'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center overflow-y-auto p-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-[var(--outline)] bg-[var(--surface)] p-8 shadow-elevation-1">
        <div>
          <Wordmark size="xl" />
          <p className="mt-1.5 text-xs text-[var(--text-dim)]">{t('auth.tagline')}</p>
        </div>
        {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>}
        <label className="block text-sm">
          {t('auth.field.email')}
          <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="flex items-center justify-between">
            {t('auth.field.password')}
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {t('auth.login.forgot')}
            </Link>
          </span>
          <input
            className="input mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
        <p className="text-center text-sm text-[var(--text-dim)]">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-[var(--accent)] hover:underline">
            {t('auth.login.createAccount')}
          </Link>
        </p>
        <p className="text-center">
          <Link to="/welcome" className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)]">
            ← Découvrir Talkio
          </Link>
        </p>
      </form>
    </div>
  );
}
