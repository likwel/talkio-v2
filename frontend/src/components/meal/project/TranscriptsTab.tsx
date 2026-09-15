import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Project, QualitativeTranscript, TranscriptReviewStep } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import EmptyState from '@/components/EmptyState';
import { SectionHeading } from '@/components/meal/mealUi';
import { IconAdd, IconDelete, IconEdit, IconGrid, IconGroups, IconList } from '@/lib/icons';
import TranscriptModal, { REVIEW_STEPS, REVIEW_STEP_LABEL } from '@/components/meal/project/TranscriptModal';

const STATUS_STYLE: Record<QualitativeTranscript['status'], string> = {
  DRAFT: 'bg-[var(--surface-2)] text-[var(--text-dim)]',
  FINAL: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};
const STATUS_LABEL: Record<QualitativeTranscript['status'], string> = { DRAFT: 'Brouillon', FINAL: 'Finalisé' };

/** Position de l'etape dans le pipeline (0 = Original ... 3 = Final), pour savoir jusqu'ou cocher. */
function stepIndex(s: TranscriptReviewStep) {
  return REVIEW_STEPS.indexOf(s);
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
}

/** Onglet « Entretiens qualitatifs » : transcripts d'entretien/FGD (fiche de collecte) rattachés au projet. */
export default function TranscriptsTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<QualitativeTranscript | null | undefined>(undefined);
  const [view, setView] = useState<'tracking' | 'cards'>('tracking');
  const list = project.transcripts ?? [];

  function refresh() {
    reload();
    qc.invalidateQueries({ queryKey: ['project', project.id] });
  }

  async function remove(t: QualitativeTranscript) {
    const ok = await dialog.confirm({
      title: 'Supprimer le transcript',
      message: `« ${t.title} » sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) {
      await api.delete(`/meal/transcripts/${t.id}`);
      refresh();
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconGroups}
        tone="violet"
        title="Entretiens qualitatifs"
        subtitle={`${list.length} transcript(s) — entretiens individuels, FGD, KII... Suivez le respect de votre stratégie d'échantillonnage et la revue interne des données.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--outline)] p-0.5">
              {(
                [
                  ['tracking', 'Tableau de suivi', IconList],
                  ['cards', 'Fiches', IconGrid],
                ] as const
              ).map(([v, lbl, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  title={lbl}
                  aria-pressed={view === v}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                    view === v ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{lbl}</span>
                </button>
              ))}
            </div>
            <button className="btn-primary btn-sm" onClick={() => setEditing(null)}>
              <IconAdd className="h-4 w-4" /> Nouveau transcript
            </button>
          </div>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<IconGroups className="h-7 w-7" />}
          title="Aucun transcript"
          hint="Consignez un entretien individuel, un focus group (FGD) ou un entretien avec informateur clé (KII) sur le terrain."
          action={
            <button className="btn-primary" onClick={() => setEditing(null)}>
              <IconAdd className="h-5 w-5" /> Nouveau transcript
            </button>
          }
        />
      ) : view === 'tracking' ? (
        <div className="card-elevated overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--outline)] bg-[var(--surface-2)] text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                <th className="px-2.5 py-2">#</th>
                <th className="px-2.5 py-2">Région</th>
                <th className="px-2.5 py-2">Zone (LGA)</th>
                <th className="px-2.5 py-2">Communauté</th>
                <th className="px-2.5 py-2">Type KII</th>
                <th className="px-2.5 py-2">Sexe</th>
                <th className="px-2.5 py-2">Organisation</th>
                <th className="px-2.5 py-2">Type d'acteur</th>
                <th className="px-2.5 py-2">Round 1</th>
                <th className="px-2.5 py-2">Round 2</th>
                <th className="px-2 py-2 text-center">Original</th>
                <th className="px-2 py-2 text-center">Révisé</th>
                <th className="px-2 py-2 text-center">Corrigé</th>
                <th className="px-2 py-2 text-center">Final</th>
                <th className="px-2.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((t, idx) => {
                const reached = stepIndex(t.reviewStep);
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-[var(--outline)] last:border-0 hover:bg-[var(--surface-2)]"
                    onClick={() => setEditing(t)}
                  >
                    <td className="px-2.5 py-2 font-semibold text-[var(--text-dim)]">{idx + 1}</td>
                    <td className="px-2.5 py-2 font-medium">{t.region || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.district || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.community || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.kiiType || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.sex || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.organizationName || t.title}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{t.marketActorType || '—'}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{fmtDate(t.interviewDate)}</td>
                    <td className="px-2.5 py-2 text-[var(--text-dim)]">{fmtDate(t.round2Date)}</td>
                    {REVIEW_STEPS.map((s, i) => (
                      <td key={s} className="px-2 py-2 text-center">
                        {reached >= i ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent-strong)]">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[var(--outline)]">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2.5 py-2 text-right">
                      <button
                        className="icon-btn-sm text-[var(--text-dim)] hover:text-red-500"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(t);
                        }}
                      >
                        <IconDelete className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <div key={t.id} className="card group flex flex-col gap-2 transition hover:border-[var(--accent-soft)]">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold item-title">{t.title}</span>
                <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS_STYLE[t.status])}>
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--text-dim)]">
                {t.interviewType && <span className="chip">{t.interviewType}</span>}
                {t.location && <span>📍 {t.location}</span>}
                {t.interviewDate && <span>{fmtDate(t.interviewDate)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--text-dim)]">
                {t.interviewees.length > 0 && <span>{t.interviewees.length} personne(s) interrogée(s)</span>}
                <span className="chip">Revue : {REVIEW_STEP_LABEL[t.reviewStep]}</span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--outline)] pt-2 text-sm">
                <button className="btn-text btn-sm" onClick={() => setEditing(t)}>
                  <IconEdit className="h-4 w-4" /> Ouvrir
                </button>
                <button className="icon-btn-sm text-[var(--text-dim)] hover:text-red-500" title="Supprimer" onClick={() => remove(t)}>
                  <IconDelete className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TranscriptModal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        project={project}
        transcript={editing ?? null}
        onSaved={refresh}
      />
    </div>
  );
}
