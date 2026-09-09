import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import Wordmark from '@/components/Wordmark';

export default function ResetPassword() {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center overflow-y-auto p-4 py-10">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-[var(--outline)] bg-[var(--surface)] p-8 shadow-elevation-1">
        <div>
          <Wordmark size="lg" />
          <p className="mt-1 text-xs text-[var(--text-dim)]">{t('auth.reset.subtitle')}</p>
        </div>

        {!token ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-950/50">
              {t('auth.reset.missingToken')}
            </div>
            <Link
              to="/forgot-password"
              className="block text-center text-sm text-[var(--accent)] hover:underline"
            >
              {t('auth.reset.requestNew')}
            </Link>
          </div>
        ) : done ? (
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
            {t('auth.reset.done')}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">
                {error}
              </div>
            )}
            <label className="block text-sm">
              {t('auth.reset.newPassword')}
              <input
                className="input mt-1"
                type="password"
                autoFocus
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              {t('auth.reset.confirm')}
              <input
                className="input mt-1"
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </button>
            <p className="text-center text-sm text-[var(--text-dim)]">
              <Link to="/login" className="text-[var(--accent)] hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
