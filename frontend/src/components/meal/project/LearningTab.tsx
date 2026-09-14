import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import type { Lesson, Project } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import { IconAdd, IconDelete, IconLightbulb } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { Badge, Field, SectionHeading } from '@/components/meal/mealUi';

const CATEGORIES = ['Ce qui a marché', 'À améliorer', 'Recommandation'];
const empty = { title: '', category: CATEGORIES[0], context: '', insight: '', recommendation: '' };

const CAT_CLS: Record<string, string> = {
  'Ce qui a marché': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'À améliorer': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Recommandation: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
};

export default function LearningTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const list = project.lessons ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/lessons`, {
      title: f.title,
      category: f.category || undefined,
      context: f.context || undefined,
      insight: f.insight,
      recommendation: f.recommendation || undefined,
    });
    setF(empty);
    setOpen(false);
    reload();
  }
  async function remove(l: Lesson) {
    const ok = await dialog.confirm({ title: 'Supprimer la leçon', message: `« ${l.title} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/lessons/${l.id}`);
      reload();
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconLightbulb}
        tone="amber"
        title="Leçons apprises"
        subtitle={`${list.length} leçon(s) capitalisée(s)`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Leçon
          </button>
        }
      />

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Titre" className="sm:col-span-3">
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </Field>
          <Field label="Catégorie">
            <Select value={f.category} onChange={(category) => setF({ ...f, category })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Contexte" className="sm:col-span-4">
            <textarea className="input" rows={2} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} />
          </Field>
          <Field label="Constat / enseignement" className="sm:col-span-4">
            <textarea className="input" rows={2} value={f.insight} onChange={(e) => setF({ ...f, insight: e.target.value })} required />
          </Field>
          <Field label="Recommandation pour la suite" className="sm:col-span-4">
            <textarea className="input" rows={2} value={f.recommendation} onChange={(e) => setF({ ...f, recommendation: e.target.value })} />
          </Field>
          <button className="btn-primary sm:col-span-4 sm:w-40">Ajouter</button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((l) => (
          <div key={l.id} className="card transition hover:border-[var(--accent-soft)] hover:shadow-elevation-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {l.category && <Badge className={CAT_CLS[l.category] ?? 'bg-[var(--surface-2)] text-[var(--text-dim)]'}>{l.category}</Badge>}
                <span className="font-semibold">{l.title}</span>
              </div>
              <button className="icon-btn-sm text-red-500" onClick={() => remove(l)} title="Supprimer">
                <IconDelete className="h-4 w-4" />
              </button>
            </div>
            {l.context && <p className="mt-1 text-2xs text-[var(--text-dim)]">Contexte : {l.context}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm">{l.insight}</p>
            {l.recommendation && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--accent-strong)]">→ {l.recommendation}</p>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <div className="sm:col-span-2">
            <EmptyState
              icon={<IconLightbulb className="h-7 w-7" />}
              title="Aucune leçon capitalisée"
              hint="Capturez ce qui a marché, ce qui peut être amélioré, et vos recommandations pour la suite."
            />
          </div>
        )}
      </div>
    </div>
  );
}
