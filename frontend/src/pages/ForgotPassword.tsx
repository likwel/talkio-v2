import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import Wordmark from '@/components/Wordmark';

export default function ForgotPassword() {
  const { user } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/forgot-password', { email });
      setDevToken(r.data?.devToken ?? null);
      setSent(true);
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
          <p className="mt-1 text-xs text-[var(--text-dim)]">{t('auth.forgot.subtitle')}</p>
        </div>

        {sent ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-strong)]">
              {t('auth.forgot.sent', { email })}
            </div>
            {devToken && (
              <div className="rounded-xl border border-dashed border-[var(--outline)] p-3 text-xs">
                <p className="mb-1 font-semibold text-[var(--text-dim)]">{t('auth.forgot.devHint')}</p>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="break-all font-medium text-[var(--accent)] hover:underline"
                >
                  {t('auth.forgot.devLink')}
                </Link>
              </div>
            )}
            <Link
              to="/login"
              className="block text-center text-sm text-[var(--accent)] hover:underline"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">
                {error}
              </div>
            )}
            <label className="block text-sm">
              {t('auth.forgot.emailLabel')}
              <input
                className="input mt-1"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button className="btn-primary w-full" disabled={busy || !email}>
              {busy ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
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
