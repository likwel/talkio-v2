import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Project, QualitativeInquiry } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import EmptyState from '@/components/EmptyState';
import { SectionHeading } from '@/components/meal/mealUi';
import { IconAdd, IconChecklist, IconDelete, IconEdit } from '@/lib/icons';
import QuipsModal from '@/components/meal/project/QuipsModal';

const STATUS_STYLE: Record<QualitativeInquiry['status'], string> = {
  DRAFT: 'bg-[var(--surface-2)] text-[var(--text-dim)]',
  FINAL: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};
const STATUS_LABEL: Record<QualitativeInquiry['status'], string> = { DRAFT: 'Brouillon', FINAL: 'Finalisée' };

/** Onglet « Enquêtes qualitatives » : fiches QuIPS (planification d'une étude qualitative) rattachées au projet. */
export default function QuipsTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<QualitativeInquiry | null | undefined>(undefined);
  const list = project.qualitativeInquiries ?? [];

  function refresh() {
    reload();
    qc.invalidateQueries({ queryKey: ['project', project.id] });
  }

  async function remove(q: QualitativeInquiry) {
    const ok = await dialog.confirm({
      title: 'Supprimer la fiche',
      message: `« ${q.title} » sera définitivement supprimée.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) {
      await api.delete(`/meal/quips/${q.id}`);
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconChecklist}
        tone="violet"
        title="Enquêtes qualitatives (QuIPS)"
        subtitle={`${list.length} fiche(s) de planification — Qualitative Inquiry Planning Sheet`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setEditing(null)}>
            <IconAdd className="h-4 w-4" /> Nouvelle fiche
          </button>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconChecklist className="h-7 w-7" />}
          title="Aucune fiche QuIPS"
          hint="Planifiez une étude ou enquête qualitative (objet, méthodologie, mise en œuvre, analyse) avec la fiche QuIPS."
          action={
            <button className="btn-primary" onClick={() => setEditing(null)}>
              <IconAdd className="h-5 w-5" /> Nouvelle fiche
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((q) => (
            <div key={q.id} className="card group flex flex-col gap-2 transition hover:border-[var(--accent-soft)]">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold item-title">{q.title}</span>
                <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS_STYLE[q.status])}>
                  {STATUS_LABEL[q.status]}
                </span>
              </div>
              {q.code && <span className="text-2xs font-medium text-[var(--text-dim)]">QM/QS # {q.code}</span>}
              {q.purpose && <p className="line-clamp-2 text-xs text-[var(--text-dim)]">{q.purpose}</p>}
              <div className="mt-auto flex items-center justify-between border-t border-[var(--outline)] pt-2 text-sm">
                <button className="btn-text btn-sm" onClick={() => setEditing(q)}>
                  <IconEdit className="h-4 w-4" /> Ouvrir
                </button>
                <button className="icon-btn-sm text-[var(--text-dim)] hover:text-red-500" title="Supprimer" onClick={() => remove(q)}>
                  <IconDelete className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <QuipsModal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        project={project}
        quips={editing ?? null}
        onSaved={refresh}
      />
    </div>
  );
}
