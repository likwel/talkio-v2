import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { FormDef } from '@/lib/types';
import { IconCheck, IconForms, IconLock } from '@/lib/icons';
import FormRenderer, { RequiredProgress } from '@/components/FormRenderer';
import { defaultsFor, validateForm, type Scope } from '@/lib/formLogic';
import Wordmark from '@/components/Wordmark';

type State = 'loading' | 'ready' | 'unavailable';

const QUEUE_KEY = 'talkio.formQueue';
const DEVICE_KEY = 'talkio.deviceId';

function deviceId(): string {
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) {
      v = 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, v);
    }
    return v;
  } catch {
    return 'd_anon';
  }
}
type Queued = { formId: string; payload: Record<string, unknown>; ts: number };
function readQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeQueue(q: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* quota / private mode */
  }
}
async function flushQueue(): Promise<number> {
  let q = readQueue();
  if (!q.length) return 0;
  const kept: Queued[] = [];
  let sent = 0;
  for (const item of q) {
    try {
      await api.post(`/public/forms/${item.formId}/responses`, item.payload, { skipErrorToast: true });
      sent++;
    } catch {
      kept.push(item);
    }
  }
  writeQueue(kept);
  return sent;
}

export default function PublicFormFill() {
  const { formId } = useParams();
  const [state, setState] = useState<State>('loading');
  const [form, setForm] = useState<FormDef | null>(null);
  const [email, setEmail] = useState('');
  const [values, setValues] = useState<Scope>({});
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);
  const [pending, setPending] = useState(readQueue().length);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fresh = (f: FormDef): Scope => {
    const base = defaultsFor(f.fields.filter((x) => !x.sectionKey));
    for (const s of f.sections ?? []) {
      if (!s.repeatable) continue;
      const kids = f.fields.filter((x) => x.sectionKey === s.key);
      base[s.key] = Array.from({ length: s.minRepeat ?? 0 }, () => defaultsFor(kids));
    }
    return base;
  };

  const tryFlush = useCallback(() => {
    flushQueue().then(() => setPending(readQueue().length));
  }, []);

  useEffect(() => {
    tryFlush();
    window.addEventListener('online', tryFlush);
    return () => window.removeEventListener('online', tryFlush);
  }, [tryFlush]);

  useEffect(() => {
    let alive = true;
    api
      .get<FormDef>(`/public/forms/${formId}`)
      .then((r) => {
        if (!alive) return;
        setForm(r.data);
        setValues(fresh(r.data));
        setState('ready');
      })
      .catch(() => alive && setState('unavailable'));
    return () => {
      alive = false;
    };
  }, [formId]);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const validation = useMemo(() => (form ? validateForm(form, values) : null), [form, values]);
  const allRequired = !!validation?.ok && emailOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!emailOk || (validation && !validation.ok)) {
      setShowErrors(true);
      setError('Vérifiez votre e-mail, les champs obligatoires et les contraintes.');
      return;
    }
    const payload = {
      email: email.trim(),
      answers: values,
      deviceId: deviceId(),
      ...coords,
    };
    setBusy(true);
    try {
      await api.post(`/public/forms/${formId}/responses`, payload, { skipErrorToast: true });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      const offline = !err?.response || err?.code === 'ERR_NETWORK' || !navigator.onLine;
      if (offline && formId) {
        const q = readQueue();
        q.push({ formId, payload, ts: Date.now() });
        writeQueue(q);
        setPending(q.length);
        setQueued(true);
        setDone(true);
        window.scrollTo({ top: 0 });
      } else {
        setError(err?.response?.data?.error ?? 'Envoi impossible. Vérifiez les champs obligatoires.');
      }
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setDone(false);
    setQueued(false);
    setShowErrors(false);
    if (form) setValues(fresh(form));
    setCoords({});
    setEmail('');
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] px-4 py-6 text-[var(--text)] sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-white">
              <IconForms className="h-5 w-5" />
            </span>
            <Wordmark size="sm" />
          </span>
          <span className="inline-flex items-center gap-1 text-2xs text-[var(--text-dim)]">
            <IconLock className="h-3.5 w-3.5" /> Formulaire sécurisé
          </span>
        </div>

        {pending > 0 && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
            {pending} réponse(s) en attente d'envoi — elles partiront automatiquement au retour du réseau.
          </div>
        )}

        {state === 'loading' && (
          <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-dim)]">
            Chargement…
          </div>
        )}

        {state === 'unavailable' && (
          <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-6 text-center">
            <h1 className="font-display text-lg font-bold">Formulaire indisponible</h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Ce lien n'est plus valide : le formulaire a été fermé, n'a jamais été publié, ou nécessite une connexion.
            </p>
          </div>
        )}

        {state === 'ready' && form && !done && (
          <form onSubmit={submit} className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--outline)] bg-[var(--surface)]">
              <div className="p-5 sm:p-6">
                <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{form.title}</h1>
                {form.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-dim)]">
                    {form.description}
                  </p>
                )}
              </div>
              <div className="border-t border-[var(--outline)] px-5 py-2.5 sm:px-6">
                <RequiredProgress form={form} values={values} extra={1} extraDone={emailOk ? 1 : 0} />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>
            )}

            <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-5 sm:p-6">
              <label className="block">
                <span className="block text-sm font-medium">
                  Votre adresse e-mail<span className="text-red-500"> *</span>
                  <span className="mt-0.5 block text-xs font-normal text-[var(--text-dim)]">
                    Nécessaire pour valider votre participation.
                  </span>
                </span>
                <input
                  className="input mt-1"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <FormRenderer form={form} values={values} onChange={setValues} onGeo={setCoords} showErrors={showErrors} />

            <button className="btn-primary btn-lg w-full sm:w-auto" disabled={busy || !allRequired}>
              {busy ? 'Envoi…' : 'Envoyer ma réponse'}
            </button>
            <p className="text-2xs text-[var(--text-dim)]">
              Ne saisissez jamais de mot de passe dans un formulaire. Réponse anonyme (seul l'e-mail est conservé).
            </p>
          </form>
        )}

        {state === 'ready' && done && (
          <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <IconCheck className="h-8 w-8" />
            </span>
            <h1 className="mt-3 font-display text-lg font-bold">Merci !</h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              {queued
                ? "Vous êtes hors-ligne : votre réponse est enregistrée sur cet appareil et sera envoyée automatiquement."
                : 'Votre réponse a bien été enregistrée.'}
            </p>
            <button className="btn-outlined mx-auto mt-4" onClick={again}>
              Envoyer une autre réponse
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
