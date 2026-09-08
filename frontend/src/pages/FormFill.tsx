import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { FormDef, FormField } from '@/lib/types';
import { IconCheck, IconLocation, IconBack } from '@/lib/icons';

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

  if (!form) return <div className="p-6 text-slate-400">Chargement…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Link to="/forms" className="icon-btn" aria-label="Retour a la collecte">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">{form.title}</h1>
      </div>
      {form.description && <p className="text-slate-500">{form.description}</p>}
      {count > 0 && <p className="text-xs text-slate-400">{count} reponse(s) envoyee(s) cette session</p>}

      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <IconCheck className="h-4 w-4" /> Reponse enregistree
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{error}</div>}

      <form onSubmit={submit} className="card space-y-4">
        {form.fields.map((field) => (
          <FieldInput key={field.key} field={field} value={values[field.key]} onChange={(v) => setVal(field.key, v)} onGeo={setCoords} />
        ))}
        <button className="btn-primary">Envoyer</button>
      </form>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onGeo,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  onGeo: (c: { latitude?: number; longitude?: number }) => void;
}) {
  const label = (
    <span className="block text-sm font-medium">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
      {field.helpText && <span className="mt-0.5 block text-xs font-normal text-[var(--text-dim)]">{field.helpText}</span>}
    </span>
  );

  switch (field.type) {
    case 'TEXTAREA':
      return (
        <label className="block">
          {label}
          <textarea
            className="input mt-1"
            rows={3}
            placeholder={field.placeholder}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );
    case 'NUMBER':
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            type="number"
            placeholder={field.placeholder}
            min={field.minValue ?? undefined}
            max={field.maxValue ?? undefined}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            required={field.required}
          />
        </label>
      );
    case 'DATE':
      return (
        <label className="block">
          {label}
          <input className="input mt-1" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required} />
        </label>
      );
    case 'BOOLEAN':
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case 'SELECT':
      return (
        <label className="block">
          {label}
          <select className="input mt-1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required}>
            <option value="">—</option>
            {field.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      );
    case 'MULTISELECT':
      return (
        <div>
          {label}
          <div className="mt-1 flex flex-wrap gap-3">
            {field.options.map((o) => {
              const arr: string[] = Array.isArray(value) ? value : [];
              return (
                <label key={o} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={arr.includes(o)}
                    onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                  />
                  {o}
                </label>
              );
            })}
          </div>
        </div>
      );
    case 'GEOPOINT':
      return (
        <div>
          {label}
          <button
            type="button"
            className="btn-outlined mt-1 h-10"
            onClick={() =>
              navigator.geolocation.getCurrentPosition((pos) => {
                const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                onChange(`${c.latitude},${c.longitude}`);
                onGeo(c);
              })
            }
          >
            <IconLocation className="h-4 w-4" /> Capturer ma position
          </button>
          {value && <span className="ml-2 text-xs text-slate-500">{value}</span>}
        </div>
      );
    case 'PHOTO':
      return (
        <label className="block">
          {label}
          <input
            className="mt-1 block text-sm"
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
          />
        </label>
      );
    default:
      return (
        <label className="block">
          {label}
          <input
            className="input mt-1"
            placeholder={field.placeholder}
            pattern={field.pattern || undefined}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </label>
      );
  }
}
