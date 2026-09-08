import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { FormDef } from '@/lib/types';
import { IconCheck, IconBack } from '@/lib/icons';
import FormFieldInput from '@/components/FormFieldInput';

export default function FormFill() {
  const { formId } = useParams();
  const [form, setForm] = useState<FormDef | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    api.get<FormDef>(`/forms/${formId}`).then((r) => {
      setForm(r.data);
      const defaults: Record<string, any> = {};
      for (const f of r.data.fields) {
        if (f.defaultValue) defaults[f.key] = f.type === 'NUMBER' ? Number(f.defaultValue) : f.defaultValue;
      }
      setValues(defaults);
    });
  }, [formId]);

  function setVal(key: string, value: any) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/forms/${formId}/responses`, { answers: values, ...coords });
      setDone(true);
      setCount((c) => c + 1);
      setValues({});
      setTimeout(() => setDone(false), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Envoi impossible');
    }
  }

  if (!form) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;

  return (
    <div className="page max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/forms" className="icon-btn" aria-label="Retour a la collecte">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="page-title truncate">{form.title}</h1>
      </div>
      {form.description && <p className="text-[var(--text-dim)]">{form.description}</p>}
      {count > 0 && <p className="text-xs text-[var(--text-dim)]">{count} reponse(s) envoyee(s) cette session</p>}

      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <IconCheck className="h-4 w-4" /> Reponse enregistree
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>}

      <form onSubmit={submit} className="card space-y-4">
        {form.fields.map((field) => (
          <FormFieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(v) => setVal(field.key, v)}
            onGeo={setCoords}
          />
        ))}
        <button className="btn-primary">Envoyer</button>
      </form>
    </div>
  );
}
