import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { FormDef } from '@/lib/types';
import { IconCheck, IconBack } from '@/lib/icons';
import FormRenderer, { RequiredProgress } from '@/components/FormRenderer';
import { defaultsFor, validateForm, type Scope } from '@/lib/formLogic';

export default function FormFill() {
  const { formId } = useParams();
  const [form, setForm] = useState<FormDef | null>(null);
  const [values, setValues] = useState<Scope>({});
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);

  const fresh = (f: FormDef): Scope => {
    const base = defaultsFor(f.fields.filter((x) => !x.sectionKey));
    for (const s of f.sections ?? []) {
      if (!s.repeatable) continue;
      const kids = f.fields.filter((x) => x.sectionKey === s.key);
      base[s.key] = Array.from({ length: s.minRepeat ?? 0 }, () => defaultsFor(kids));
    }
    return base;
  };

  useEffect(() => {
    api.get<FormDef>(`/forms/${formId}`).then((r) => {
      setForm(r.data);
      setValues(fresh(r.data));
    });
  }, [formId]);

  const validation = useMemo(() => (form ? validateForm(form, values) : null), [form, values]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (validation && !validation.ok) {
      setShowErrors(true);
      setError('Vérifiez les champs obligatoires et les contraintes.');
      return;
    }
    try {
      await api.post(`/forms/${formId}/responses`, { answers: values, ...coords });
      setDone(true);
      setShowErrors(false);
      setCount((c) => c + 1);
      if (form) setValues(fresh(form));
      setTimeout(() => setDone(false), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Envoi impossible');
    }
  }

  if (!form) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;

  return (
    <div className="page max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/forms" className="icon-btn" aria-label="Retour à la collecte">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="page-title truncate">{form.title}</h1>
        {form.version ? <span className="chip shrink-0 text-2xs">v{form.version}</span> : null}
      </div>
      {form.description && <p className="text-[var(--text-dim)]">{form.description}</p>}
      {count > 0 && <p className="text-xs text-[var(--text-dim)]">{count} réponse(s) envoyée(s) cette session</p>}

      <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-2.5">
        <RequiredProgress form={form} values={values} />
      </div>

      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <IconCheck className="h-4 w-4" /> Réponse enregistrée
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <FormRenderer form={form} values={values} onChange={setValues} onGeo={setCoords} showErrors={showErrors} />
        <button className="btn-primary">Envoyer</button>
      </form>
    </div>
  );
}
