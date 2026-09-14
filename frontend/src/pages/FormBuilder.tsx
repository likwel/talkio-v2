import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import type { FieldType, FormDef, FormField, FormSection } from '@/lib/types';
import { RELEVANT_OPS, opNeedsValue, relevantOpLabel } from '@/lib/formLogic';
import {
  IconAdd,
  IconDelete,
  IconPublish,
  IconUnpublish,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconPersonAdd,
} from '@/lib/icons';
import Select from '@/components/Select';
import AssignFormModal from '@/components/AssignFormModal';

type Status = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', CLOSED: 'Fermé' };
const STATUS_HINT: Record<Status, string> = {
  DRAFT: "Brouillon : visible seulement par vous. Publiez-le pour ouvrir la saisie et partager le lien.",
  PUBLISHED: 'Publié : n’importe qui disposant du lien public peut répondre, sans compte.',
  CLOSED: 'Fermé : les réponses ne sont plus acceptées. Rouvrez-le pour reprendre la collecte.',
};

const FIELD_GROUPS: { group: string; items: { value: FieldType; label: string }[] }[] = [
  {
    group: 'Texte',
    items: [
      { value: 'TEXT', label: 'Texte court' },
      { value: 'TEXTAREA', label: 'Texte long' },
      { value: 'NOTE', label: 'Note (texte affiché)' },
      { value: 'EMAIL', label: 'E-mail' },
      { value: 'PHONE', label: 'Téléphone' },
      { value: 'URL', label: 'Lien (URL)' },
      { value: 'BARCODE', label: 'Code-barres / QR' },
    ],
  },
  {
    group: 'Nombre',
    items: [
      { value: 'NUMBER', label: 'Nombre' },
      { value: 'INTEGER', label: 'Entier' },
      { value: 'DECIMAL', label: 'Décimal' },
      { value: 'RANGE', label: 'Curseur (min–max)' },
      { value: 'RATING', label: 'Note (1 à 5 étoiles)' },
    ],
  },
  {
    group: 'Date & heure',
    items: [
      { value: 'DATE', label: 'Date' },
      { value: 'DATETIME', label: 'Date et heure' },
      { value: 'TIME', label: 'Heure' },
    ],
  },
  {
    group: 'Choix',
    items: [
      { value: 'SELECT', label: 'Choix unique' },
      { value: 'MULTISELECT', label: 'Choix multiples' },
      { value: 'BOOLEAN', label: 'Oui / Non' },
      { value: 'ACKNOWLEDGE', label: 'Accusé (case à cocher)' },
    ],
  },
  {
    group: 'Média & terrain',
    items: [
      { value: 'GEOPOINT', label: 'Point GPS' },
      { value: 'PHOTO', label: 'Photo' },
      { value: 'SIGNATURE', label: 'Signature' },
    ],
  },
];
const FIELD_TYPES = FIELD_GROUPS.flatMap((g) => g.items);
const TYPE_LABEL = (t: FieldType) => FIELD_TYPES.find((x) => x.value === t)?.label ?? t;
const hasOptions = (t: FieldType) => t === 'SELECT' || t === 'MULTISELECT';
const isNumeric = (t: FieldType) => ['NUMBER', 'INTEGER', 'DECIMAL', 'RANGE'].includes(t);

/** Un champ est « bien configuré ». */
function fieldOk(f: FormField): boolean {
  if (f.type === 'NOTE') return !!f.label.trim();
  if (!f.label.trim() || !f.key.trim()) return false;
  if (hasOptions(f.type) && f.options.filter(Boolean).length === 0) return false;
  if (f.relevantField && f.relevantOp && opNeedsValue(f.relevantOp) && !String(f.relevantValue ?? '').trim())
    return false;
  return true;
}

const emptyField = (position: number): FormField => ({
  label: '',
  key: `champ_${position + 1}`,
  type: 'TEXT',
  required: false,
  position,
  options: [],
  sectionKey: null,
});

const slug = (s: string, fallback: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
  fallback;

export default function FormBuilder() {
  const { formId } = useParams();
  const [search] = useSearchParams();
  const linkProjectId = search.get('projectId') || undefined;
  const { workspaces, personal } = useWorkspace();
  const navigate = useNavigate();
  const dialog = useDialog();
  const editing = !!formId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wsId, setWsId] = useState('');
  const [status, setStatus] = useState<Status>('DRAFT');
  const [assignOpen, setAssignOpen] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [version, setVersion] = useState(1);
  const [requireLogin, setRequireLogin] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [fields, setFields] = useState<FormField[]>([emptyField(0)]);
  const [openKeys, setOpenKeys] = useState<Set<number>>(() => new Set([0]));
  const [publicCode, setPublicCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleField = (i: number) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  useEffect(() => {
    if (!editing) return;
    api.get(`/forms/${formId}`).then((r) => {
      setTitle(r.data.title);
      setDescription(r.data.description ?? '');
      setStatus(r.data.status);
      setWsId(r.data.workspace?.id ?? r.data.workspaceId ?? '');
      setCanManage(r.data.canManage !== false);
      setVersion(r.data.version ?? 1);
      setPublicCode(r.data.publicCode ?? null);
      setRequireLogin(!!r.data.requireLogin);
      setAllowMultiple(r.data.allowMultiple !== false);
      setSections(
        (r.data.sections ?? []).map((s: FormSection, i: number) => ({ ...s, position: s.position ?? i })),
      );
      const loaded: FormField[] = (r.data.fields ?? []).map((f: FormField, i: number) => ({
        ...f,
        position: f.position ?? i,
        options: f.options ?? [],
      }));
      setFields(loaded.length ? loaded : [emptyField(0)]);
      setOpenKeys(new Set());
    });
  }, [editing, formId]);

  function update(i: number, patch: Partial<FormField>) {
    setFields((f) => f.map((field, idx) => (idx === i ? { ...field, ...patch } : field)));
  }
  function move(i: number, dir: -1 | 1) {
    setFields((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.length) return f;
      const copy = f.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy.map((x, k) => ({ ...x, position: k }));
    });
    setOpenKeys(new Set());
  }

  // --- Sections -----------------------------------------------------------
  function addSection() {
    const n = sections.length + 1;
    setSections((s) => [
      ...s,
      {
        key: `section_${n}`,
        title: `Section ${n}`,
        description: '',
        position: s.length,
        repeatable: false,
        repeatLabel: '',
        minRepeat: null,
        maxRepeat: null,
        relevantField: null,
        relevantOp: null,
        relevantValue: null,
      },
    ]);
  }
  function updateSection(i: number, patch: Partial<FormSection>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function removeSection(i: number) {
    const key = sections[i].key;
    setSections((s) => s.filter((_, idx) => idx !== i));
    setFields((f) => f.map((x) => (x.sectionKey === key ? { ...x, sectionKey: null } : x)));
  }

  const sectionOptions = useMemo(
    () => [{ value: '', label: 'Aucune (racine)' }, ...sections.map((s) => ({ value: s.key, label: s.title }))],
    [sections],
  );

  const publicLink = formId ? `${window.location.origin}/f/${publicCode ?? formId}` : '';
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      await dialog.alert({ title: 'Lien public', message: publicLink });
    }
  }

  function buildPayload() {
    return {
      title,
      description: description || undefined,
      requireLogin,
      allowMultiple,
      sections: sections.map((s, i) => ({
        key: slug(s.key || s.title, `section_${i + 1}`),
        title: s.title || `Section ${i + 1}`,
        description: s.description || undefined,
        position: i,
        repeatable: !!s.repeatable,
        repeatLabel: s.repeatLabel || undefined,
        minRepeat: s.minRepeat ?? undefined,
        maxRepeat: s.maxRepeat ?? undefined,
        relevantField: s.relevantField || undefined,
        relevantOp: s.relevantOp || undefined,
        relevantValue: s.relevantValue || undefined,
      })),
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
        sectionKey: f.sectionKey || undefined,
        relevantField: f.relevantField || undefined,
        relevantOp: f.relevantOp || undefined,
        relevantValue: f.relevantValue || undefined,
        constraintExpr: f.constraintExpr || undefined,
        constraintMessage: f.constraintMessage || undefined,
        calculation: f.calculation || undefined,
        appearance: f.appearance || undefined,
        rangeStep: f.rangeStep ?? undefined,
      })),
    };
  }

  async function save(nextStatus?: Status) {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await api.put(`/forms/${formId}`, { ...payload, status: nextStatus ?? status });
      } else {
        const created = await api.post('/forms', {
          workspaceId: wsId || personal?.id || workspaces[0]?.id,
          projectId: linkProjectId,
          ...payload,
        });
        if (nextStatus && nextStatus !== 'DRAFT') {
          await api.put(`/forms/${created.data.id}`, { status: nextStatus });
        }
      }
      navigate(linkProjectId ? `/meal/projects/${linkProjectId}?t=collecte` : '/meal?tab=forms');
    } finally {
      setSaving(false);
    }
  }

  async function removeForm() {
    if (!formId) return;
    const ok = await dialog.confirm({
      title: 'Supprimer le formulaire',
      message: `« ${title || 'Ce formulaire'} » et toutes ses reponses seront definitivement supprimes.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/forms/${formId}`);
    } catch (err: any) {
      await dialog.alert({
        title: 'Suppression impossible',
        message: err?.response?.data?.error ?? 'Action refusee.',
      });
      return;
    }
    navigate(linkProjectId ? `/meal/projects/${linkProjectId}?t=collecte` : '/meal?tab=forms');
  }

  async function exportDefinition() {
    if (!formId) return;
    const r = await api.get(`/forms/${formId}/definition`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'formulaire').replace(/\s+/g, '_')}.talkioform.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const readyCount = fields.filter(fieldOk).length;

  return (
    <div className="page max-w-8xl space-y-6">
      <h1 className="page-title">
        {editing ? 'Éditer le formulaire' : 'Nouveau formulaire'}
        {editing && <span className="chip ml-2 text-2xs">v{version}</span>}
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
        {!editing && workspaces.length > 1 && (
          <label className="block sm:w-64">
            <span className="field-label">Espace</span>
            <Select
              aria-label="Espace"
              searchable
              value={wsId || personal?.id || workspaces[0]?.id || ''}
              onChange={setWsId}
              options={workspaces.map((w) => ({
                value: w.id,
                label: w.isPersonal ? 'Personnel' : w.name,
              }))}
            />
          </label>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={requireLogin} onChange={(e) => setRequireLogin(e.target.checked)} />
            Exiger une connexion (désactive le lien public anonyme)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />
            Autoriser plusieurs réponses par appareil
          </label>
        </div>

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
                  <input className="input h-8 text-xs" readOnly value={publicLink} onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn-tonal btn-sm shrink-0" onClick={copyLink}>
                    <IconCopy className="h-4 w-4" /> {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
          <span>Sections ({sections.length})</span>
          <button type="button" className="font-semibold text-[var(--accent)] hover:underline" onClick={addSection}>
            + Ajouter une section
          </button>
        </div>
        {sections.map((s, i) => (
          <div key={i} className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="input"
                placeholder="Titre de la section"
                value={s.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
              />
              <input
                className="input sm:w-44"
                placeholder="clé (a-z_)"
                value={s.key}
                onChange={(e) => updateSection(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
              />
              <button type="button" className="icon-btn-sm text-red-500 sm:self-center" onClick={() => removeSection(i)}>
                <IconDelete className="h-4 w-4" />
              </button>
            </div>
            <input
              className="input mt-2 text-sm"
              placeholder="Description (optionnel)"
              value={s.description ?? ''}
              onChange={(e) => updateSection(i, { description: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!!s.repeatable}
                  onChange={(e) => updateSection(i, { repeatable: e.target.checked })}
                />
                Section répétable
              </label>
              {s.repeatable && (
                <>
                  <input
                    className="input h-8 w-40 text-sm"
                    placeholder="Libellé d'une entrée"
                    value={s.repeatLabel ?? ''}
                    onChange={(e) => updateSection(i, { repeatLabel: e.target.value })}
                  />
                  <input
                    className="input h-8 w-20 text-sm"
                    type="number"
                    placeholder="min"
                    value={s.minRepeat ?? ''}
                    onChange={(e) =>
                      updateSection(i, { minRepeat: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                  <input
                    className="input h-8 w-20 text-sm"
                    type="number"
                    placeholder="max"
                    value={s.maxRepeat ?? ''}
                    onChange={(e) =>
                      updateSection(i, { maxRepeat: e.target.value === '' ? null : Number(e.target.value) })
                    }
                  />
                </>
              )}
            </div>
            <ConditionRow
              className="mt-2"
              label="Afficher la section si"
              fieldKeys={fields.map((f) => f.key)}
              relevantField={s.relevantField ?? ''}
              relevantOp={s.relevantOp ?? ''}
              relevantValue={s.relevantValue ?? ''}
              onChange={(patch) => updateSection(i, patch)}
            />
          </div>
        ))}
      </div>

      {/* Champs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
          <span>
            Champs ({fields.length}) · {readyCount} prêt(s)
          </span>
          <button
            type="button"
            className="font-semibold text-[var(--accent)] hover:underline"
            onClick={() => setOpenKeys((prev) => (prev.size ? new Set() : new Set(fields.map((_, i) => i))))}
          >
            {openKeys.size ? 'Tout replier' : 'Tout déplier'}
          </button>
        </div>

        {fields.map((field, i) => {
          const open = openKeys.has(i);
          const ok = fieldOk(field);
          return (
            <div key={i} className="overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Monter"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="text-[var(--text-dim)] hover:text-[var(--text)] disabled:opacity-30"
                    disabled={i === fields.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Descendre"
                  >
                    ▼
                  </button>
                </div>
                <button type="button" onClick={() => toggleField(i)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span
                    className={clsx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full',
                      ok ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2)] text-[var(--text-dim)]',
                    )}
                    title={ok ? 'Champ prêt' : 'Champ incomplet'}
                  >
                    {ok ? <IconCheck className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{field.label.trim() || 'Champ sans titre'}</span>
                    <span className="block text-2xs text-[var(--text-dim)]">
                      {TYPE_LABEL(field.type)}
                      {field.sectionKey ? ` · ${sections.find((s) => s.key === field.sectionKey)?.title ?? field.sectionKey}` : ''}
                      {field.required ? ' · obligatoire' : ''}
                      {field.relevantField ? ' · conditionnel' : ''}
                      {field.calculation ? ' · calculé' : ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn-sm text-red-500"
                  title="Supprimer le champ"
                  onClick={() => setFields((f) => f.filter((_, idx) => idx !== i))}
                >
                  <IconDelete className="h-4 w-4" />
                </button>
                <button type="button" className="icon-btn-sm" onClick={() => toggleField(i)} aria-label={open ? 'Replier' : 'Déplier'}>
                  <IconChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </button>
              </div>

              {open && (
                <div className="space-y-3 border-t border-[var(--outline)] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="input"
                      placeholder="Libellé du champ"
                      value={field.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                    />
                    <select
                      className="input sm:w-56"
                      aria-label="Type de champ"
                      value={field.type}
                      onChange={(e) => update(i, { type: e.target.value as FieldType })}
                    >
                      {FIELD_GROUPS.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <input
                      className="input w-40"
                      placeholder="clé (a-z_)"
                      value={field.key}
                      onChange={(e) => update(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
                    />
                    {field.type !== 'NOTE' && (
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={field.required} onChange={(e) => update(i, { required: e.target.checked })} />
                        Obligatoire
                      </label>
                    )}
                    <label className="flex items-center gap-1.5">
                      Section
                      <Select
                        className="w-44"
                        aria-label="Section"
                        value={field.sectionKey ?? ''}
                        onChange={(v) => update(i, { sectionKey: v || null })}
                        options={sectionOptions}
                      />
                    </label>
                  </div>

                  {hasOptions(field.type) && (
                    <input
                      className="input text-sm"
                      placeholder="Options séparées par des virgules"
                      value={field.options.join(', ')}
                      onChange={(e) =>
                        update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                      }
                    />
                  )}
                  {hasOptions(field.type) && (
                    <label className="flex items-center gap-1.5 text-sm">
                      Apparence
                      <Select
                        className="w-44"
                        aria-label="Apparence"
                        value={field.appearance ?? ''}
                        onChange={(v) => update(i, { appearance: v || null })}
                        options={[
                          { value: '', label: 'Menu déroulant' },
                          { value: 'minimal', label: 'Boutons (liste)' },
                          { value: 'likert', label: 'Boutons (en ligne)' },
                          ...(field.type === 'MULTISELECT' ? [{ value: 'columns', label: 'Colonnes' }] : []),
                        ]}
                      />
                    </label>
                  )}
                  {field.type === 'RANGE' && (
                    <div className="flex flex-wrap gap-2 text-sm">
                      <input
                        className="input w-24"
                        type="number"
                        placeholder="min"
                        value={field.minValue ?? ''}
                        onChange={(e) => update(i, { minValue: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <input
                        className="input w-24"
                        type="number"
                        placeholder="max"
                        value={field.maxValue ?? ''}
                        onChange={(e) => update(i, { maxValue: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <input
                        className="input w-24"
                        type="number"
                        placeholder="pas"
                        value={field.rangeStep ?? ''}
                        onChange={(e) => update(i, { rangeStep: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {/* Aide / placeholder / défaut / bornes */}
                  {field.type !== 'NOTE' && (
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
                        placeholder="Valeur par défaut"
                        value={field.defaultValue ?? ''}
                        onChange={(e) => update(i, { defaultValue: e.target.value })}
                      />
                      {isNumeric(field.type) && field.type !== 'RANGE' && (
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
                  )}

                  {/* Logique d'affichage */}
                  <ConditionRow
                    className="border-t border-[var(--outline)] pt-2"
                    label="Afficher ce champ si"
                    fieldKeys={fields.filter((_, idx) => idx !== i).map((f) => f.key)}
                    relevantField={field.relevantField ?? ''}
                    relevantOp={field.relevantOp ?? ''}
                    relevantValue={field.relevantValue ?? ''}
                    onChange={(patch) => update(i, patch)}
                  />

                  {/* Contrainte + calcul */}
                  {field.type !== 'NOTE' && (
                    <div className="grid gap-2 border-t border-[var(--outline)] pt-2 text-sm sm:grid-cols-2">
                      <input
                        className="input font-mono text-xs"
                        placeholder="Contrainte, ex. . > 0 and . <= 120"
                        value={field.constraintExpr ?? ''}
                        onChange={(e) => update(i, { constraintExpr: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Message si contrainte non respectée"
                        value={field.constraintMessage ?? ''}
                        onChange={(e) => update(i, { constraintMessage: e.target.value })}
                      />
                      <input
                        className="input font-mono text-xs sm:col-span-2"
                        placeholder="Calcul (lecture seule), ex. {poids} / ({taille} * {taille})"
                        value={field.calculation ?? ''}
                        onChange={(e) => update(i, { calculation: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          className="btn-outlined"
          onClick={() => {
            setFields((f) => [...f, emptyField(f.length)]);
            setOpenKeys((prev) => new Set(prev).add(fields.length));
          }}
        >
          <IconAdd className="h-4 w-4" /> Ajouter un champ
        </button>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-[var(--outline)] bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6">
        <button className="btn-primary" onClick={() => save()} disabled={saving || !title.trim()}>
          {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Enregistrer le brouillon'}
        </button>

        {(!editing || status === 'DRAFT') && (
          <button className="btn-tonal" onClick={() => save('PUBLISHED')} disabled={saving || !title.trim()}>
            <IconPublish className="h-4 w-4" /> Enregistrer et publier
          </button>
        )}
        {editing && status === 'PUBLISHED' && (
          <button className="btn-tonal" onClick={() => save('PUBLISHED')} disabled={saving}>
            <IconPublish className="h-4 w-4" /> Redéployer (v{version + 1})
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
        {editing && (
          <button className="btn-text" onClick={exportDefinition} disabled={saving}>
            <IconCopy className="h-4 w-4" /> Exporter (.json)
          </button>
        )}
        {editing && (
          <button className="btn-text" onClick={() => setAssignOpen(true)} disabled={saving}>
            <IconPersonAdd className="h-4 w-4" /> Assigner
          </button>
        )}
        {editing && canManage && (
          <button className="btn-text text-red-500" onClick={removeForm} disabled={saving}>
            <IconDelete className="h-4 w-4" /> Supprimer
          </button>
        )}

        <button className="btn-text ml-auto" onClick={() => navigate('/meal?tab=forms')}>
          Annuler
        </button>
      </div>

      <AssignFormModal
        form={
          assignOpen && formId
            ? ({ id: formId, title, status, fields: [], workspace: { id: wsId, name: '' } } as FormDef)
            : null
        }
        onClose={() => setAssignOpen(false)}
      />
    </div>
  );
}

/** Ligne « Afficher si <champ> <opérateur> <valeur> ». */
function ConditionRow({
  className,
  label,
  fieldKeys,
  relevantField,
  relevantOp,
  relevantValue,
  onChange,
}: {
  className?: string;
  label: string;
  fieldKeys: string[];
  relevantField: string;
  relevantOp: string;
  relevantValue: string;
  onChange: (patch: { relevantField?: string | null; relevantOp?: any; relevantValue?: string | null }) => void;
}) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-2 text-sm', className)}>
      <span className="text-xs font-semibold text-[var(--text-dim)]">{label}</span>
      <Select
        className="w-40"
        aria-label="Champ conditionnel"
        value={relevantField}
        onChange={(v) => onChange({ relevantField: v || null, ...(v ? {} : { relevantOp: null, relevantValue: null }) })}
        options={[{ value: '', label: '— toujours affiché —' }, ...fieldKeys.map((k) => ({ value: k, label: k }))]}
      />
      {relevantField && (
        <Select
          className="w-48"
          aria-label="Opérateur"
          value={relevantOp}
          onChange={(v) => onChange({ relevantOp: v || null })}
          options={RELEVANT_OPS.map((op) => ({ value: op, label: relevantOpLabel(op) }))}
        />
      )}
      {relevantField && relevantOp && opNeedsValue(relevantOp as any) && (
        <input
          className="input h-8 w-40 text-sm"
          placeholder="valeur"
          value={relevantValue}
          onChange={(e) => onChange({ relevantValue: e.target.value })}
        />
      )}
    </div>
  );
}
