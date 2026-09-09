// Logique partagée du moteur d'enquête : évaluation du « relevant » (skip logic),
// aplatissement des réponses en lignes FormAnswer (avec sections répétables),
// et contrôle des champs obligatoires en tenant compte de la logique d'affichage.

import { badRequest } from '../../lib/http';

export type RelevantOp = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'empty' | 'notempty';

interface FieldLike {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  sectionId: string | null;
  relevantField: string | null;
  relevantOp: string | null;
  relevantValue: string | null;
}
interface SectionLike {
  id: string;
  key: string;
  title: string;
  repeatable: boolean;
  minRepeat: number | null;
  relevantField: string | null;
  relevantOp: string | null;
  relevantValue: string | null;
}
export interface FormLike {
  fields: FieldLike[];
  sections: SectionLike[];
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Évalue une condition d'affichage. `scope` = valeurs consultables (entrée courante d'un repeat, sinon racine). */
export function evalRelevant(
  op: string | null | undefined,
  refField: string | null | undefined,
  refValue: string | null | undefined,
  scope: Record<string, unknown>,
): boolean {
  if (!refField || !op) return true; // pas de condition => toujours affiché
  const actual = scope[refField];
  switch (op as RelevantOp) {
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

export interface AnswerRow {
  fieldId: string;
  groupIndex: number;
  value: unknown;
}

/**
 * Transforme le dictionnaire `answers` reçu de l'API en lignes FormAnswer.
 * - clé = section répétable  -> `answers[key]` est un tableau d'objets { childKey: valeur }
 * - clé = champ simple        -> une ligne (groupIndex 0)
 */
export function buildAnswerRows(form: FormLike, answers: Record<string, unknown>): AnswerRow[] {
  const repeatSectionByKey = new Map(form.sections.filter((s) => s.repeatable).map((s) => [s.key, s]));
  const fieldsBySection = new Map<string, FieldLike[]>();
  for (const f of form.fields) {
    if (!f.sectionId) continue;
    const arr = fieldsBySection.get(f.sectionId) ?? [];
    arr.push(f);
    fieldsBySection.set(f.sectionId, arr);
  }
  const repeatFieldIds = new Set(
    form.sections
      .filter((s) => s.repeatable)
      .flatMap((s) => (fieldsBySection.get(s.id) ?? []).map((f) => f.id)),
  );
  const fieldByKey = new Map(form.fields.map((f) => [f.key, f]));

  const rows: AnswerRow[] = [];
  for (const [key, raw] of Object.entries(answers ?? {})) {
    const repeatSection = repeatSectionByKey.get(key);
    if (repeatSection) {
      const entries = Array.isArray(raw) ? raw : [];
      const childByKey = new Map((fieldsBySection.get(repeatSection.id) ?? []).map((f) => [f.key, f]));
      entries.forEach((entry, i) => {
        if (!entry || typeof entry !== 'object') return;
        for (const [ck, cv] of Object.entries(entry as Record<string, unknown>)) {
          const cf = childByKey.get(ck);
          if (cf && !isEmpty(cv)) rows.push({ fieldId: cf.id, groupIndex: i, value: cv });
        }
      });
      continue;
    }
    const field = fieldByKey.get(key);
    if (!field || repeatFieldIds.has(field.id)) continue; // champ inconnu ou géré via son repeat
    if (!isEmpty(raw)) rows.push({ fieldId: field.id, groupIndex: 0, value: raw });
  }
  return rows;
}

/** Vérifie les champs obligatoires visibles (skip logic prise en compte). Lève badRequest sinon. */
export function assertRequired(form: FormLike, answers: Record<string, unknown>): void {
  const root = answers ?? {};
  const sectionById = new Map(form.sections.map((s) => [s.id, s]));

  const sectionVisible = (s: SectionLike, scope: Record<string, unknown>) =>
    evalRelevant(s.relevantOp, s.relevantField, s.relevantValue, scope);

  for (const f of form.fields) {
    if (!f.required) continue;
    const section = f.sectionId ? sectionById.get(f.sectionId) : undefined;

    if (section?.repeatable) {
      if (!sectionVisible(section, root)) continue;
      const entries = Array.isArray(root[section.key]) ? (root[section.key] as Record<string, unknown>[]) : [];
      const minRepeat = section.minRepeat ?? (entries.length ? 0 : 0);
      if (entries.length < minRepeat) {
        throw badRequest(`La section « ${section.title} » demande au moins ${minRepeat} entrée(s).`);
      }
      entries.forEach((entry, i) => {
        const scope = { ...root, ...(entry ?? {}) };
        if (!evalRelevant(f.relevantOp, f.relevantField, f.relevantValue, scope)) return;
        if (isEmpty((entry ?? {})[f.key])) {
          throw badRequest(`Champ obligatoire manquant (${section.title} #${i + 1}) : ${f.label}`);
        }
      });
      continue;
    }

    if (section && !sectionVisible(section, root)) continue;
    if (!evalRelevant(f.relevantOp, f.relevantField, f.relevantValue, root)) continue;
    if (isEmpty(root[f.key])) throw badRequest(`Champ obligatoire manquant : ${f.label}`);
  }
}

/** Aperçu texte court d'une soumission pour les automatisations / notifications. */
export function previewAnswers(form: FormLike, answers: Record<string, unknown>): string {
  return form.fields
    .filter((f) => !f.sectionId || !form.sections.find((s) => s.id === f.sectionId)?.repeatable)
    .slice(0, 3)
    .map((f) => {
      const v = answers?.[f.key];
      return `${f.label}: ${Array.isArray(v) ? v.join(', ') : (v ?? '—')}`;
    })
    .join(' · ');
}
