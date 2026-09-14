import { FormEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { PeriodReport, Project } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import { IconAdd, IconDelete, IconReport } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { Bar, Field, SectionHeading, inPeriod, periodOptions } from '@/components/meal/mealUi';

export default function ReportsTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ period: periodOptions()[1]?.value ?? '', title: '', narrative: '', achievements: '', challenges: '' });
  const list = project.reports ?? [];
  const [sel, setSel] = useState(list[0]?.id ?? '');
  const current = list.find((r) => r.id === sel) ?? list[0];

  async function add(e: FormEvent) {
    e.preventDefault();
    const r = await api.post<PeriodReport>(`/meal/projects/${project.id}/reports`, {
      period: f.period,
      title: f.title || `Rapport ${f.period}`,
      narrative: f.narrative || undefined,
      achievements: f.achievements || undefined,
      challenges: f.challenges || undefined,
    });
    setF({ ...f, title: '', narrative: '', achievements: '', challenges: '' });
    setOpen(false);
    setSel(r.data.id);
    reload();
  }
  async function remove(r: PeriodReport) {
    const ok = await dialog.confirm({ title: 'Supprimer le rapport', message: `« ${r.title} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/reports/${r.id}`);
      setSel('');
      reload();
    }
  }

  const snapshot = useMemo(() => {
    if (!current) return [];
    return (project.indicators ?? []).map((ind) => {
      const achieved = (ind.measurements ?? [])
        .filter((m) => inPeriod(current.period, m.periodStart))
        .reduce((s, m) => s + m.value, 0);
      const periodTarget = ind.targets?.find((t) => t.period === current.period)?.target ?? null;
      const pct = periodTarget ? Math.round((achieved / periodTarget) * 100) : null;
      return { ind, achieved, periodTarget, pct };
    });
  }, [current, project.indicators]);

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconReport}
        tone="amber"
        title="Rapports de période"
        subtitle="Narratif + performance des indicateurs recalculée pour la période."
        action={
          <>
            {list.length > 0 && (
              <Select
                className="w-48"
                value={current?.id ?? ''}
                onChange={setSel}
                options={list.map((r) => ({ value: r.id, label: `${r.title} (${r.period})` }))}
              />
            )}
            <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
              <IconAdd className="h-4 w-4" /> Rapport
            </button>
          </>
        }
      />

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Période">
            <Select value={f.period} onChange={(period) => setF({ ...f, period })} options={periodOptions()} />
          </Field>
          <Field label="Titre" className="sm:col-span-3">
            <input className="input" placeholder={`Rapport ${f.period}`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Synthèse narrative" className="sm:col-span-4">
            <textarea className="input" rows={3} value={f.narrative} onChange={(e) => setF({ ...f, narrative: e.target.value })} />
          </Field>
          <Field label="Principales réalisations" className="sm:col-span-2">
            <textarea className="input" rows={3} value={f.achievements} onChange={(e) => setF({ ...f, achievements: e.target.value })} />
          </Field>
          <Field label="Difficultés rencontrées" className="sm:col-span-2">
            <textarea className="input" rows={3} value={f.challenges} onChange={(e) => setF({ ...f, challenges: e.target.value })} />
          </Field>
          <button className="btn-primary sm:col-span-4 sm:w-40">Créer</button>
        </form>
      )}

      {!current && !open && (
        <EmptyState
          icon={<IconReport className="h-7 w-7" />}
          title="Aucun rapport"
          hint="Créez-en un pour figer l’avancement d’un trimestre ou d’une année et le partager."
        />
      )}

      {current && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-md font-bold">{current.title}</h3>
              <p className="text-2xs text-[var(--text-dim)]">
                Période {current.period} · créé le {new Date(current.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <button className="icon-btn-sm text-red-500" onClick={() => remove(current)} title="Supprimer">
              <IconDelete className="h-4 w-4" />
            </button>
          </div>

          {current.narrative && (
            <div className="card">
              <div className="field-label">Synthèse</div>
              <p className="whitespace-pre-wrap text-sm">{current.narrative}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {current.achievements && (
              <div className="card">
                <div className="field-label">Réalisations</div>
                <p className="whitespace-pre-wrap text-sm">{current.achievements}</p>
              </div>
            )}
            {current.challenges && (
              <div className="card">
                <div className="field-label">Difficultés</div>
                <p className="whitespace-pre-wrap text-sm">{current.challenges}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--surface-2)] text-2xs uppercase tracking-wide text-[var(--text-dim)]">
                <tr>
                  <th className="px-3 py-2 text-left">Indicateur</th>
                  <th className="px-3 py-2 text-right">Réalisé ({current.period})</th>
                  <th className="px-3 py-2 text-right">Cible période</th>
                  <th className="px-3 py-2 text-left">Atteinte</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.map(({ ind, achieved, periodTarget, pct }) => (
                  <tr key={ind.id} className="border-t border-[var(--outline)] transition hover:bg-[var(--surface-2)]">
                    <td className="px-3 py-2">
                      <span className="text-[var(--text-dim)]">{ind.code}</span> — {ind.name}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{achieved}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-dim)]">{periodTarget ?? '—'}</td>
                    <td className="px-3 py-2">
                      {pct == null ? (
                        <span className="text-2xs text-[var(--text-dim)]">pas de cible</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-24"><Bar pct={pct} tone={pct >= 90 ? 'emerald' : pct >= 50 ? 'accent' : 'amber'} /></div>
                          <span className="text-2xs font-semibold">{pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {snapshot.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-2xs text-[var(--text-dim)]">
                      Aucun indicateur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
