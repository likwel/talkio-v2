import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { FormField } from '@/lib/types';
import { IconCheck, IconForms } from '@/lib/icons';
import FormFieldInput from '@/components/FormFieldInput';
import Wordmark from '@/components/Wordmark';

interface PublicForm {
  id: string;
  title: string;
  description?: string | null;
  fields: FormField[];
}

type State = 'loading' | 'ready' | 'unavailable';

export default function PublicFormFill() {
  const { formId } = useParams();
  const [state, setState] = useState<State>('loading');
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<PublicForm>(`/public/forms/${formId}`)
      .then((r) => {
        if (!alive) return;
        setForm(r.data);
        const defaults: Record<string, any> = {};
        for (const f of r.data.fields) {
          if (f.defaultValue) defaults[f.key] = f.type === 'NUMBER' ? Number(f.defaultValue) : f.defaultValue;
        }
        setValues(defaults);
        setState('ready');
      })
      .catch(() => alive && setState('unavailable'));
    return () => {
      alive = false;
    };
  }, [formId]);

  function setVal(key: string, value: any) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(`/public/forms/${formId}/responses`, { answers: values, ...coords });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setDone(false);
    setValues({});
    setCoords({});
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-[var(--text-dim)]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-white">
            <IconForms className="h-5 w-5" />
          </span>
          <span className="font-display text-sm font-bold">
            <Wordmark size="sm" /> · Collecte
          </span>
        </div>

        {state === 'loading' && (
          <div className="card text-center text-sm text-[var(--text-dim)]">Chargement…</div>
        )}

        {state === 'unavailable' && (
          <div className="card space-y-2 text-center">
            <h1 className="section-title">Formulaire indisponible</h1>
            <p className="text-sm text-[var(--text-dim)]">
              Ce lien n'est plus valide : le formulaire a ete ferme ou n'a jamais ete publie.
            </p>
          </div>
        )}

        {state === 'ready' && form && !done && (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-5 sm:p-6">
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{form.title}</h1>
              {form.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-dim)]">{form.description}</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>
            )}

            <div className="space-y-4 rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-5 sm:p-6">
              {form.fields.map((field) => (
                <FormFieldInput
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setVal(field.key, v)}
                  onGeo={setCoords}
                />
              ))}
            </div>

            <button className="btn-primary btn-lg w-full sm:w-auto" disabled={busy}>
              {busy ? 'Envoi…' : 'Envoyer ma reponse'}
            </button>
            <p className="text-2xs text-[var(--text-dim)]">
              Ne saisissez jamais de mot de passe dans un formulaire. Reponse anonyme.
            </p>
          </form>
        )}

        {state === 'ready' && done && (
          <div className="card space-y-3 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <IconCheck className="h-7 w-7" />
            </span>
            <h1 className="section-title">Merci !</h1>
            <p className="text-sm text-[var(--text-dim)]">Votre reponse a bien ete enregistree.</p>
            <button className="btn-outlined mx-auto" onClick={again}>
              Envoyer une autre reponse
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
