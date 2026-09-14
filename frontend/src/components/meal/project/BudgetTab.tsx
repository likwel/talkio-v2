import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import type { BudgetLine, Project } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import { IconAdd, IconDelete, IconWallet, IconTrending } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { Bar, Field, KpiTile, SectionHeading, money } from '@/components/meal/mealUi';

const empty = { label: '', donor: '', category: '', planned: '', spent: '' };

export default function BudgetTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const cur = project.currency ?? 'USD';
  const lines = project.budgetLines ?? [];
  const planned = lines.reduce((s, l) => s + l.planned, 0);
  const spent = lines.reduce((s, l) => s + l.spent, 0);
  const rate = planned ? Math.round((spent / planned) * 100) : 0;

  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/budget`, {
      label: f.label,
      donor: f.donor || undefined,
      category: f.category || undefined,
      planned: f.planned ? Number(f.planned) : 0,
      spent: f.spent ? Number(f.spent) : 0,
    });
    setF(empty);
    setOpen(false);
    reload();
  }

  async function patch(id: string, data: Partial<BudgetLine>) {
    await api.patch(`/meal/budget/${id}`, data);
    reload();
  }

  async function remove(l: BudgetLine) {
    const ok = await dialog.confirm({ title: 'Supprimer la ligne', message: `« ${l.label} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/budget/${l.id}`);
      reload();
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconWallet}
        tone="sky"
        title="Budget & exécution financière"
        subtitle={`${lines.length} ligne(s) budgetaire(s)`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Ligne
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile icon={IconWallet} tone="sky" label="Budget prévu" value={money(planned, cur)} />
        <KpiTile icon={IconWallet} tone="accent" label="Dépense" value={money(spent, cur)} />
        <KpiTile
          icon={IconTrending}
          tone={rate > 100 ? 'red' : rate >= 80 ? 'amber' : 'emerald'}
          label="Taux d'exécution"
          value={`${rate}%`}
          sub={planned > 0 && <Bar pct={rate} tone={rate > 100 ? 'red' : rate >= 90 ? 'amber' : 'accent'} />}
        />
      </div>

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Intitule" className="sm:col-span-2">
            <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} required />
          </Field>
          <Field label="Bailleur">
            <input className="input" value={f.donor} onChange={(e) => setF({ ...f, donor: e.target.value })} />
          </Field>
          <Field label="Catégorie">
            <input className="input" placeholder="RH, logistique…" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Field>
          <Field label={`Prévu (${cur})`}>
            <input className="input" type="number" value={f.planned} onChange={(e) => setF({ ...f, planned: e.target.value })} />
          </Field>
          <Field label={`Dépense (${cur})`}>
            <input className="input" type="number" value={f.spent} onChange={(e) => setF({ ...f, spent: e.target.value })} />
          </Field>
          <button className="btn-primary sm:col-span-4 sm:w-40">Ajouter</button>
        </form>
      )}

      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--surface-2)] text-2xs uppercase tracking-wide text-[var(--text-dim)]">
              <tr>
                <th className="px-3 py-2 text-left">Ligne</th>
                <th className="px-3 py-2 text-left">Bailleur</th>
                <th className="px-3 py-2 text-right">Prévu</th>
                <th className="px-3 py-2 text-right">Dépense</th>
                <th className="px-3 py-2 text-right">Reste</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const lrate = l.planned ? Math.round((l.spent / l.planned) * 100) : 0;
                return (
                  <tr key={l.id} className="border-t border-[var(--outline)] transition hover:bg-[var(--surface-2)]">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.label}</div>
                      {l.category && <div className="text-2xs text-[var(--text-dim)]">{l.category}</div>}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">{l.donor || '—'}</td>
                    <td className="px-3 py-2 text-right">{money(l.planned, cur)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        className="input h-8 w-28 text-right"
                        type="number"
                        defaultValue={l.spent}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== l.spent) patch(l.id, { spent: v });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">{money(l.planned - l.spent, cur)}</td>
                    <td className={'px-3 py-2 text-right font-semibold ' + (lrate > 100 ? 'text-red-500' : '')}>{lrate}%</td>
                    <td className="px-3 py-2 text-right">
                      <button className="icon-btn-sm text-red-500" onClick={() => remove(l)} title="Supprimer">
                        <IconDelete className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lines.length === 0 && (
        <EmptyState
          icon={<IconWallet className="h-7 w-7" />}
          title="Aucune ligne budgetaire"
          hint="Ajoutez une ligne pour suivre le budget prévu et dépense du projet."
        />
      )}
    </div>
  );
}
