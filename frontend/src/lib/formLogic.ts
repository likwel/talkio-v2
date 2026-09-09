// Moteur d'enquête côté client : logique d'affichage (skip logic), contraintes,
// champs calculés, et mise en forme des réponses (sections répétables incluses).
// Miroir de backend/src/modules/forms/logic.ts pour l'évaluation du « relevant ».

import type { FormDef, FormField, FormResponse, FormSection, RelevantOp } from '@/lib/types';

export type Scope = Record<string, unknown>;

export const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const RELEVANT_OP_LABEL: Record<RelevantOp, string> = {
  eq: 'est égal à',
  ne: 'est différent de',
  gt: 'est supérieur à',
  lt: 'est inférieur à',
  gte: 'est supérieur ou égal à',
  lte: 'est inférieur ou égal à',
  contains: 'contient',
  empty: 'est vide',
  notempty: "n'est pas vide",
};
export const RELEVANT_OPS = Object.keys(RELEVANT_OP_LABEL) as RelevantOp[];
export const relevantOpLabel = (op: RelevantOp) => RELEVANT_OP_LABEL[op];
export const opNeedsValue = (op: RelevantOp) => op !== 'empty' && op !== 'notempty';

/** Évalue une condition d'affichage contre un scope de valeurs. */
export function evalRelevant(
  op: RelevantOp | null | undefined,
  refField: string | null | undefined,
  refValue: string | null | undefined,
  scope: Scope,
): boolean {
  if (!refField || !op) return true;
  const actual = scope[refField];
  switch (op) {
    case 'empty':
      return isEmpty(actual);
    case 'notempty':
      return !isEmpty(actual);
    case 'eq':
      return String(actual ?? '') === String(refValue ?? '');
    case 'ne':
      return String(actual ?? '') !== String(refValue ?? '');
    case 'gt':
      return Number(actual) > Number(refValue);
    case 'lt':
      return Number(actual) < Number(refValue);
    case 'gte':
      return Number(actual) >= Number(refValue);
    case 'lte':
      return Number(actual) <= Number(refValue);
    case 'contains':
      return Array.isArray(actual)
        ? actual.map(String).includes(String(refValue))
        : String(actual ?? '').includes(String(refValue ?? ''));
    default:
      return true;
  }
}

export const isFieldVisible = (f: FormField, scope: Scope): boolean =>
  evalRelevant(f.relevantOp, f.relevantField, f.relevantValue, scope);

export const isSectionVisible = (s: FormSection, scope: Scope): boolean =>
  evalRelevant(s.relevantOp, s.relevantField, s.relevantValue, scope);

/** Prépare une expression `{clé}` / `.` en JS évaluable. */
function prepareExpr(expr: string, scope: Scope, selfValue?: unknown): string {
  let out = expr.replace(/\{([a-z0-9_]+)\}/gi, (_m, k: string) => JSON.stringify(scope[k] ?? ''));
  if (selfValue !== undefined) out = out.replace(/(^|[^<>=!.])\.(?![0-9])/g, (_m, p) => `${p}${JSON.stringify(selfValue)}`);
  // opérateurs « humains »
  out = out
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
    .replace(/([^<>=!])=([^=])/g, '$1==$2');
  return out;
}

function safeEval(js: string): unknown {
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${js});`)();
}

/** Vérifie une contrainte de champ. Renvoie true si valide (ou expression vide/illisible). */
export function checkConstraint(expr: string | null | undefined, value: unknown, scope: Scope): boolean {
  if (!expr || !expr.trim()) return true;
  if (isEmpty(value)) return true; // la contrainte ne s'applique qu'à une valeur saisie
  try {
    return !!safeEval(prepareExpr(expr, scope, value));
  } catch {
    return true;
  }
}

/** Calcule la valeur d'un champ calculé. */
export function computeCalculation(expr: string | null | undefined, scope: Scope): unknown {
  if (!expr || !expr.trim()) return '';
  try {
    const r = safeEval(prepareExpr(expr, scope));
    return typeof r === 'number' && !Number.isFinite(r) ? '' : (r as unknown);
  } catch {
    return '';
  }
}

// --- Mise en forme des réponses -----------------------------------------------

export interface ShapedResponse {
  flat: Record<string, unknown>; // clé de champ simple -> valeur
  repeats: Record<string, Record<string, unknown>[]>; // clé de section répétable -> entrées
}

export function repeatSections(form: Pick<FormDef, 'sections'>): FormSection[] {
  return (form.sections ?? []).filter((s) => s.repeatable);
}

/** Transforme les lignes brutes d'une réponse en structure exploitable. */
export function shapeResponse(form: FormDef, resp: FormResponse): ShapedResponse {
  const fieldById = new Map((form.fields ?? []).map((f) => [f.id ?? f.key, f]));
  const sectionByKey = new Map((form.sections ?? []).map((s) => [s.key, s]));
  const repeatSectionIdByFieldId = new Map<string, string>();
  for (const f of form.fields ?? []) {
    if (!f.sectionKey) continue;
    const sec = sectionByKey.get(f.sectionKey);
    if (sec?.repeatable && f.id) repeatSectionIdByFieldId.set(f.id, sec.key);
  }

  const flat: Record<string, unknown> = {};
  const repeats: Record<string, Record<string, unknown>[]> = {};
  for (const s of repeatSections(form)) repeats[s.key] = [];

  for (const a of resp.answers) {
    const field = fieldById.get(a.fieldId);
    if (!field) continue;
    const repeatKey = repeatSectionIdByFieldId.get(a.fieldId);
    if (repeatKey) {
      const idx = a.groupIndex ?? 0;
      const arr = repeats[repeatKey];
      while (arr.length <= idx) arr.push({});
      arr[idx][field.key] = a.value;
    } else {
      flat[field.key] = a.value;
    }
  }
  return { flat, repeats };
}

export interface FormValidation {
  missing: string[]; // chemins des champs obligatoires vides et visibles
  errors: Record<string, string>; // chemin -> message de contrainte
  ok: boolean;
}

/** Valide un jeu de valeurs contre la structure (skip logic + contraintes + min repeat). */
export function validateForm(form: FormDef, values: Scope): FormValidation {
  const missing: string[] = [];
  const errors: Record<string, string> = {};
  const sectionByKey = new Map((form.sections ?? []).map((s) => [s.key, s]));
  const repeatKeys = new Set(repeatSections(form).map((s) => s.key));

  const checkField = (f: FormField, scope: Scope, path: string) => {
    if (f.type === 'NOTE' || f.calculation) return;
    if (!isFieldVisible(f, scope)) return;
    const v = scope[f.key];
    if (f.required && isEmpty(v) && f.type !== 'BOOLEAN' && f.type !== 'ACKNOWLEDGE') missing.push(path);
    if (f.required && (f.type === 'ACKNOWLEDGE') && v !== true && v !== 'OK') missing.push(path);
    if (!checkConstraint(f.constraintExpr, v, scope)) {
      errors[path] = f.constraintMessage || 'Valeur non conforme à la contrainte.';
    }
  };

  for (const f of form.fields ?? []) {
    if (f.sectionKey && repeatKeys.has(f.sectionKey)) continue; // géré plus bas
    const sec = f.sectionKey ? sectionByKey.get(f.sectionKey) : undefined;
    if (sec && !isSectionVisible(sec, values)) continue;
    checkField(f, values, f.key);
  }

  for (const s of repeatSections(form)) {
    if (!isSectionVisible(s, values)) continue;
    const entries = Array.isArray(values[s.key]) ? (values[s.key] as Scope[]) : [];
    if (s.minRepeat && entries.length < s.minRepeat) {
      errors[s.key] = `Au moins ${s.minRepeat} entrée(s) requise(s).`;
    }
    const children = (form.fields ?? []).filter((f) => f.sectionKey === s.key);
    entries.forEach((entry, i) => {
      const scope = { ...values, ...entry };
      for (const f of children) checkField(f, scope, `${s.key}.${i}.${f.key}`);
    });
  }

  return { missing, errors, ok: missing.length === 0 && Object.keys(errors).length === 0 };
}

/** Valeurs par défaut d'une entrée de section répétable / d'un formulaire. */
export function defaultsFor(fields: FormField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue == null || f.defaultValue === '') continue;
    out[f.key] =
      f.type === 'NUMBER' || f.type === 'INTEGER' || f.type === 'DECIMAL' || f.type === 'RANGE'
        ? Number(f.defaultValue)
        : f.defaultValue;
  }
  return out;
}
