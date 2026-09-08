import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import type { FieldType, FormField } from '@/lib/types';
import { IconAdd, IconDelete, IconPublish, IconUnpublish, IconCopy } from '@/lib/icons';
import Select from '@/components/Select';

type Status = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publie', CLOSED: 'Ferme' };
const STATUS_HINT: Record<Status, string> = {
  DRAFT: "Brouillon : visible seulement par vous. Publiez-le pour ouvrir la saisie et partager le lien.",
  PUBLISHED: 'Publie : n’importe qui disposant du lien public peut repondre, sans compte.',
  CLOSED: 'Ferme : les reponses ne sont plus acceptees. Rouvrez-le pour reprendre la collecte.',
};

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
  const dialog = useDialog();
  const editing = !!formId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('DRAFT');
  const [fields, setFields] = useState<FormField[]>([emptyField(0)]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const publicLink = formId ? `${window.location.origin}/f/${formId}` : '';
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      await dialog.alert({ title: 'Lien public', message: publicLink });
    }
  }

  /** Enregistre ; `nextStatus` change l'etat de publication (formulaire existant). */
  async function save(nextStatus?: Status) {
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
        await api.put(`/forms/${formId}`, { ...payload, status: nextStatus ?? status });
      } else {
        const created = await api.post('/forms', { workspaceId: current!.id, ...payload });
        if (nextStatus && nextStatus !== 'DRAFT') {
          await api.put(`/forms/${created.data.id}`, { status: nextStatus });
        }
      }
      navigate('/forms');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page max-w-8xl space-y-6">
      <h1 className="page-title">
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
          <div className="rounded-lg border border-[var(--outline)] bg-[var(--surface-2)] p-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  'rounded-md px-2 py-0.5 text-2xs font-semibold ' +
                  (status === 'PUBLISHED'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                    : status === 'CLOSED'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                      : 'bg-[var(--surface)] text-[var(--text-dim)]')
                }
              >
                {STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-[var(--text-dim)]">{STATUS_HINT[status]}</span>
            </div>
            {status === 'PUBLISHED' && (
              <div className="mt-2">
                <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                  Lien public (aucune connexion requise)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="input h-8 text-xs"
                    readOnly
                    value={publicLink}
                    onFocus={(e) => e.target.select()}
                  />
                  <button type="button" className="btn-tonal btn-sm shrink-0" onClick={copyLink}>
                    <IconCopy className="h-4 w-4" /> {copied ? 'Copie' : 'Copier'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
              <Select
                className="sm:w-48"
                aria-label="Type de champ"
                value={field.type}
                onChange={(v) => update(i, { type: v as FieldType })}
                options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
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
                type="button"
                className="btn-text btn-sm ml-auto text-red-600 hover:bg-red-500/10 hover:text-red-700"
                onClick={() => setFields((f) => f.filter((_, idx) => idx !== i))}
              >
                <IconDelete className="h-4 w-4" /> Supprimer
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

        <button className="btn-outlined" onClick={() => setFields((f) => [...f, emptyField(f.length)])}>
          <IconAdd className="h-4 w-4" /> Ajouter un champ
        </button>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-[var(--outline)] bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6">
        <button className="btn-primary" onClick={() => save()} disabled={saving || !title.trim()}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Enregistrer le brouillon'}
        </button>

        {(!editing || status === 'DRAFT') && (
          <button
            className="btn-tonal"
            onClick={() => save('PUBLISHED')}
            disabled={saving || !title.trim()}
          >
            <IconPublish className="h-4 w-4" /> Enregistrer et publier
          </button>
        )}
        {editing && status === 'PUBLISHED' && (
          <button className="btn-outlined" onClick={() => save('CLOSED')} disabled={saving}>
            <IconUnpublish className="h-4 w-4" /> Fermer la collecte
          </button>
        )}
        {editing && status === 'CLOSED' && (
          <button className="btn-tonal" onClick={() => save('PUBLISHED')} disabled={saving}>
            <IconPublish className="h-4 w-4" /> Rouvrir
          </button>
        )}

        <button className="btn-text ml-auto" onClick={() => navigate('/forms')}>
          Annuler
        </button>
      </div>
    </div>
  );
}
