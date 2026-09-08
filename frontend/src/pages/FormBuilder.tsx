import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { FieldType, FormField } from '@/lib/types';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'TEXT', label: 'Texte court' },
  { value: 'TEXTAREA', label: 'Texte long' },
  { value: 'NUMBER', label: 'Nombre' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Liste deroulante' },
  { value: 'MULTISELECT', label: 'Choix multiples' },
  { value: 'BOOLEAN', label: 'Oui / Non' },
  { value: 'GEOPOINT', label: 'Point GPS' },
  { value: 'PHOTO', label: 'Photo' },
];

const emptyField = (position: number): FormField => ({
  label: '',
  key: `champ_${position + 1}`,
  type: 'TEXT',
  required: false,
  position,
  options: [],
});

export default function FormBuilder() {
  const { formId } = useParams();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const editing = !!formId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'CLOSED'>('DRAFT');
  const [fields, setFields] = useState<FormField[]>([emptyField(0)]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api.get(`/forms/${formId}`).then((r) => {
      setTitle(r.data.title);
      setDescription(r.data.description ?? '');
      setStatus(r.data.status);
      setFields(r.data.fields.length ? r.data.fields : [emptyField(0)]);
    });
  }, [editing, formId]);

  function update(i: number, patch: Partial<FormField>) {
    setFields((f) => f.map((field, idx) => (idx === i ? { ...field, ...patch } : field)));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title,
        description: description || undefined,
        fields: fields.map((f, i) => ({
          label: f.label,
          key: f.key || `champ_${i + 1}`,
          type: f.type,
          required: f.required,
          position: i,
          options: f.options,
          helpText: f.helpText || undefined,
          placeholder: f.placeholder || undefined,
          defaultValue: f.defaultValue || undefined,
          minValue: f.minValue ?? undefined,
          maxValue: f.maxValue ?? undefined,
          pattern: f.pattern || undefined,
        })),
      };
      if (editing) {
        await api.put(`/forms/${formId}`, { ...payload, status });
      } else {
        await api.post('/forms', { workspaceId: current!.id, ...payload });
      }
      navigate('/forms');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <h1 className="text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">
        {editing ? 'Editer le formulaire' : 'Nouveau formulaire'}
      </h1>

      <div className="card space-y-3">
        <input className="input" placeholder="Titre du formulaire" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="input"
          rows={2}
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {editing && (
          <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publie</option>
            <option value="CLOSED">Ferme</option>
          </select>
        )}
      </div>

      <div className="space-y-3">
        {fields.map((field, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input"
                placeholder="Libelle du champ"
                value={field.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <select
                className="input sm:w-48"
                value={field.type}
                onChange={(e) => update(i, { type: e.target.value as FieldType })}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <input
                className="input w-40"
                placeholder="cle (a-z_)"
                value={field.key}
                onChange={(e) => update(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
              />
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                Obligatoire
              </label>
              <button
                className="ml-auto rounded-full px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => setFields((f) => f.filter((_, idx) => idx !== i))}
              >
                Supprimer
              </button>
            </div>

            {(field.type === 'SELECT' || field.type === 'MULTISELECT') && (
              <input
                className="input text-sm"
                placeholder="Options separees par des virgules"
                value={field.options.join(', ')}
                onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            )}

            <div className="grid gap-2 border-t border-[var(--outline)] pt-2 text-sm sm:grid-cols-2">
              <input
                className="input"
                placeholder="Texte d'aide (sous le champ)"
                value={field.helpText ?? ''}
                onChange={(e) => update(i, { helpText: e.target.value })}
              />
              <input
                className="input"
                placeholder="Placeholder"
                value={field.placeholder ?? ''}
                onChange={(e) => update(i, { placeholder: e.target.value })}
              />
              <input
                className="input"
                placeholder="Valeur par defaut"
                value={field.defaultValue ?? ''}
                onChange={(e) => update(i, { defaultValue: e.target.value })}
              />
              {field.type === 'NUMBER' && (
                <div className="flex gap-2">
                  <input
                    className="input"
                    type="number"
                    placeholder="Min"
                    value={field.minValue ?? ''}
                    onChange={(e) => update(i, { minValue: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <input
                    className="input"
                    type="number"
                    placeholder="Max"
                    value={field.maxValue ?? ''}
                    onChange={(e) => update(i, { maxValue: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
              )}
              {(field.type === 'TEXT' || field.type === 'TEXTAREA') && (
                <input
                  className="input"
                  placeholder="Motif regex (validation)"
                  value={field.pattern ?? ''}
                  onChange={(e) => update(i, { pattern: e.target.value })}
                />
              )}
            </div>
          </div>
        ))}

        <button className="btn-ghost" onClick={() => setFields((f) => [...f, emptyField(f.length)])}>
          + Ajouter un champ
        </button>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={saving || !title.trim()}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button className="btn-ghost" onClick={() => navigate('/forms')}>
          Annuler
        </button>
      </div>
    </div>
  );
}
