import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import type { FormDef, FormField, FormSection } from '@/lib/types';
import {
  computeCalculation,
  defaultsFor,
  isFieldVisible,
  isSectionVisible,
  type Scope,
  validateForm,
} from '@/lib/formLogic';
import FormFieldInput from '@/components/FormFieldInput';
import { IconAdd, IconDelete } from '@/lib/icons';

interface Props {
  form: FormDef;
  values: Scope;
  onChange: (next: Scope) => void;
  onGeo?: (c: { latitude?: number; longitude?: number }) => void;
  /** Affiche les messages de validation en ligne. */
  showErrors?: boolean;
}

type Block = { kind: 'field'; field: FormField } | { kind: 'section'; section: FormSection; fields: FormField[] };

/** Rendu partagé d'un formulaire d'enquête : sections, sections répétables,
 *  logique d'affichage, champs calculés, contraintes. Composant contrôlé. */
export default function FormRenderer({ form, values, onChange, onGeo, showErrors }: Props) {
  const sections = useMemo(
    () => [...(form.sections ?? [])].sort((a, b) => a.position - b.position),
    [form.sections],
  );
  const fields = useMemo(
    () => [...(form.fields ?? [])].sort((a, b) => a.position - b.position),
    [form.fields],
  );
  const sectionByKey = useMemo(() => new Map(sections.map((s) => [s.key, s])), [sections]);

  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    const emitted = new Set<string>();
    for (const f of fields) {
      if (!f.sectionKey) {
        out.push({ kind: 'field', field: f });
        continue;
      }
      if (emitted.has(f.sectionKey)) continue;
      const section = sectionByKey.get(f.sectionKey);
      if (!section) {
        out.push({ kind: 'field', field: f });
        continue;
      }
      emitted.add(f.sectionKey);
      out.push({ kind: 'section', section, fields: fields.filter((x) => x.sectionKey === section.key) });
    }
    return out;
  }, [fields, sectionByKey]);

  const validation = useMemo(() => validateForm(form, values), [form, values]);

  // --- Champs calculés : recalcul automatique --------------------------------
  useEffect(() => {
    let next = values;
    let touched = false;
    const apply = (scopeGet: () => Scope, setBack: (k: string, v: unknown) => void, list: FormField[]) => {
      const scope = scopeGet();
      for (const f of list) {
        if (!f.calculation) continue;
        const v = computeCalculation(f.calculation, scope);
        if (String(scope[f.key] ?? '') !== String(v ?? '')) {
          setBack(f.key, v);
          touched = true;
        }
      }
    };
    // racine
    apply(
      () => next,
      (k, v) => (next = { ...next, [k]: v }),
      fields.filter((f) => !f.sectionKey || !sectionByKey.get(f.sectionKey)?.repeatable),
    );
    // entrées répétables
    for (const s of sections.filter((x) => x.repeatable)) {
      const arr: Scope[] = Array.isArray(next[s.key]) ? [...(next[s.key] as Scope[])] : [];
      const children = fields.filter((f) => f.sectionKey === s.key && f.calculation);
      if (!children.length) continue;
      arr.forEach((entry, i) => {
        const scope = { ...next, ...entry };
        let e = entry;
        for (const f of children) {
          const v = computeCalculation(f.calculation, scope);
          if (String(entry[f.key] ?? '') !== String(v ?? '')) {
            e = { ...e, [f.key]: v };
            touched = true;
          }
        }
        arr[i] = e;
      });
      if (touched) next = { ...next, [s.key]: arr };
    }
    if (touched) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const setField = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  const renderField = (f: FormField, scope: Scope, setter: (v: unknown) => void, path: string) => {
    if (!isFieldVisible(f, scope)) return null;
    return (
      <FormFieldInput
        key={path}
        field={f}
        value={scope[f.key]}
        readOnly={!!f.calculation}
        errorText={showErrors ? validation.errors[path] ?? null : null}
        onChange={setter}
        onGeo={onGeo}
      />
    );
  };

  // --- Section répétable ----------------------------------------------------
  const renderRepeat = (section: FormSection, childFields: FormField[]) => {
    const entries: Scope[] = Array.isArray(values[section.key]) ? (values[section.key] as Scope[]) : [];
    const max = section.maxRepeat ?? Infinity;
    const setEntries = (arr: Scope[]) => onChange({ ...values, [section.key]: arr });
    const label = section.repeatLabel || 'Entrée';
    return (
      <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4">
        <div className="mb-1 text-sm font-semibold">{section.title}</div>
        {section.description && (
          <p className="mb-2 text-xs text-[var(--text-dim)]">{section.description}</p>
        )}
        {showErrors && validation.errors[section.key] && (
          <p className="mb-2 text-xs font-medium text-red-600">{validation.errors[section.key]}</p>
        )}

        <div className="space-y-3">
          {entries.map((entry, i) => {
            const scope = { ...values, ...entry };
            const setChild = (k: string, v: unknown) => {
              const arr = entries.slice();
              arr[i] = { ...entry, [k]: v };
              setEntries(arr);
            };
            return (
              <div key={i} className="rounded-lg border border-[var(--outline)] bg-[var(--surface-2)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                    {label} #{i + 1}
                  </span>
                  <button
                    type="button"
                    className="icon-btn-sm text-red-500"
                    title="Supprimer cette entrée"
                    onClick={() => setEntries(entries.filter((_, idx) => idx !== i))}
                  >
                    <IconDelete className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {childFields.map((cf) =>
                    renderField(cf, scope, (v) => setChild(cf.key, v), `${section.key}.${i}.${cf.key}`),
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {entries.length < max && (
          <button
            type="button"
            className="btn-outlined btn-sm mt-3"
            onClick={() => setEntries([...entries, defaultsFor(childFields)])}
          >
            <IconAdd className="h-4 w-4" /> Ajouter {label.toLowerCase()}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {blocks.map((b, bi) => {
        if (b.kind === 'field') {
          return renderField(b.field, values, (v) => setField(b.field.key, v), b.field.key);
        }
        if (!isSectionVisible(b.section, values)) return null;
        if (b.section.repeatable) return <div key={`s${bi}`}>{renderRepeat(b.section, b.fields)}</div>;
        return (
          <div key={`s${bi}`} className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4">
            <div className="mb-1 text-sm font-semibold">{b.section.title}</div>
            {b.section.description && (
              <p className="mb-3 text-xs text-[var(--text-dim)]">{b.section.description}</p>
            )}
            <div className="space-y-3">
              {b.fields.map((cf) => renderField(cf, values, (v) => setField(cf.key, v), cf.key))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Barre de progression des champs obligatoires visibles. */
export function RequiredProgress({
  form,
  values,
  extra = 0,
  extraDone = 0,
}: {
  form: FormDef;
  values: Scope;
  extra?: number;
  extraDone?: number;
}) {
  const { total, done } = useMemo(() => {
    const v = validateForm(form, values);
    // total requis = requis visibles ; done = requis visibles renseignés
    const requiredVisible = countRequiredVisible(form, values);
    return { total: requiredVisible + extra, done: requiredVisible - v.missing.length + extraDone };
  }, [form, values, extra, extraDone]);
  const pct = total ? Math.round((Math.max(0, done) / total) * 100) : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-2xs font-medium text-[var(--text-dim)]">
        <span>Champs obligatoires</span>
        <span className={pct === 100 ? 'text-emerald-600' : undefined}>
          {Math.max(0, done)} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className={clsx('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-[var(--accent)]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function countRequiredVisible(form: FormDef, values: Scope): number {
  let n = 0;
  const sectionByKey = new Map((form.sections ?? []).map((s) => [s.key, s]));
  for (const f of form.fields ?? []) {
    if (!f.required || f.type === 'NOTE' || f.calculation) continue;
    const sec = f.sectionKey ? sectionByKey.get(f.sectionKey) : undefined;
    if (sec?.repeatable) continue;
    if (sec && !isSectionVisible(sec, values)) continue;
    if (!isFieldVisible(f, values)) continue;
    n++;
  }
  for (const s of (form.sections ?? []).filter((x) => x.repeatable)) {
    if (!isSectionVisible(s, values)) continue;
    const entries = Array.isArray(values[s.key]) ? (values[s.key] as Scope[]) : [];
    const children = (form.fields ?? []).filter((f) => f.sectionKey === s.key && f.required && !f.calculation);
    entries.forEach((entry) => {
      const scope = { ...values, ...entry };
      for (const cf of children) if (isFieldVisible(cf, scope)) n++;
    });
  }
  return n;
}
