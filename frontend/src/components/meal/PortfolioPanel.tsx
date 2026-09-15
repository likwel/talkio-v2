import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { IconNext, IconKanban, IconTrending, IconWallet, IconError, IconAdd } from '@/lib/icons';
import WorkspaceTag from '@/components/WorkspaceTag';
import EmptyState from '@/components/EmptyState';
import { Bar, KpiTile, PROJECT_HEALTH, PROJECT_STATUS, money, projectTint } from '@/components/meal/mealUi';

export default function PortfolioPanel() {
  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: async () => (await api.get<Project[]>('/meal/projects')).data,
  });
  const list = projects.data ?? [];

  const agg = useMemo(() => {
    const planned = list.reduce((s, p) => s + (p.budget?.planned ?? 0), 0);
    const spent = list.reduce((s, p) => s + (p.budget?.spent ?? 0), 0);
    const withProgress = list.filter((p) => p.avgIndicator != null);
    const avgIndicator = withProgress.length
      ? Math.round(withProgress.reduce((s, p) => s + (p.avgIndicator ?? 0), 0) / withProgress.length)
      : null;
    const openRisks = list.reduce((s, p) => s + (p._count?.risks ?? 0), 0);
    const pendingFeedback = list.reduce((s, p) => s + (p._count?.feedback ?? 0), 0);
    const byStatus = (['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).map((st) => ({
      st,
      n: list.filter((p) => (p.status ?? 'ACTIVE') === st).length,
    }));
    return { planned, spent, avgIndicator, openRisks, pendingFeedback, byStatus };
  }, [list]);

  if (projects.isLoading) return <div className="text-sm text-[var(--text-dim)]">Chargement…</div>;
  if (list.length === 0)
    return (
      <EmptyState
        icon={<IconKanban className="h-7 w-7" />}
        title="Aucun projet dans le portefeuille"
        hint="Créez un projet MEAL pour voir apparaitre son avancement, son budget et sa santé ici."
        action={
          <Link to="/meal?tab=projets" className="btn-primary">
            <IconAdd className="h-5 w-5" /> Nouveau projet
          </Link>
        }
      />
    );

  const burn = agg.planned ? Math.round((agg.spent / agg.planned) * 100) : null;
  const attention = agg.openRisks + agg.pendingFeedback;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={IconKanban}
          tone="accent"
          label="Projets"
          value={list.length}
          sub={agg.byStatus.filter((b) => b.n).map((b) => `${b.n} ${PROJECT_STATUS[b.st].label.toLowerCase()}`).join(' · ')}
        />
        <KpiTile
          icon={IconTrending}
          tone="violet"
          label="Avancement moyen des indicateurs"
          value={agg.avgIndicator == null ? '—' : `${agg.avgIndicator}%`}
          sub={agg.avgIndicator != null && <Bar pct={agg.avgIndicator} tone={agg.avgIndicator >= 90 ? 'emerald' : agg.avgIndicator >= 50 ? 'accent' : 'amber'} />}
        />
        <KpiTile
          icon={IconWallet}
          tone={burn != null && burn > 100 ? 'red' : 'emerald'}
          label="Exécution budgetaire"
          value={burn == null ? '—' : `${burn}%`}
          sub={`${money(agg.spent)} / ${money(agg.planned)}`}
        />
        <KpiTile
          icon={IconError}
          tone={attention > 0 ? 'amber' : 'emerald'}
          label="Points d'attention"
          value={attention}
          sub={`${agg.openRisks} risque(s) · ${agg.pendingFeedback} retour(s)`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[var(--surface-2)] text-2xs uppercase tracking-wide text-[var(--text-dim)]">
            <tr>
              <th className="px-3 py-2.5 text-left">Projet</th>
              <th className="px-3 py-2.5 text-left">Statut</th>
              <th className="px-3 py-2.5 text-left">Santé</th>
              <th className="px-3 py-2.5 text-left">Indicateurs</th>
              <th className="px-3 py-2.5 text-right">Budget</th>
              <th className="px-3 py-2.5 text-right">Activités</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const st = p.status ?? 'ACTIVE';
              const h = p.health ?? 'ON_TRACK';
              return (
                <tr key={p.id} className="group border-t border-[var(--outline)] transition hover:bg-[var(--surface-2)]">
                  <td className="px-3 py-2.5">
                    <Link to={`/meal/projects/${p.id}`} className="flex items-center gap-2.5">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-2xs font-bold text-white"
                        style={{ background: projectTint(p.id) }}
                      >
                        {(p.code || p.name).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="item-title block truncate font-semibold">{p.name}</span>
                        <span className="flex items-center gap-1.5 text-2xs text-[var(--text-dim)]">
                          {p.code || '—'}
                          {p.workspace && <WorkspaceTag ws={p.workspace} />}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={'inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold ' + PROJECT_STATUS[st].cls}>
                      {PROJECT_STATUS[st].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={'inline-flex items-center gap-1 text-2xs font-semibold ' + PROJECT_HEALTH[h].cls}>
                      <span className={'h-2 w-2 rounded-full ' + PROJECT_HEALTH[h].dot} />
                      {PROJECT_HEALTH[h].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.avgIndicator == null ? (
                      <span className="text-2xs text-[var(--text-dim)]">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-20"><Bar pct={p.avgIndicator} tone={p.avgIndicator >= 90 ? 'emerald' : p.avgIndicator >= 50 ? 'accent' : 'amber'} /></div>
                        <span className="text-2xs font-semibold">{p.avgIndicator}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {p.budget?.rate == null ? '—' : <span className={p.budget.rate > 100 ? 'font-semibold text-red-500' : ''}>{p.budget.rate}%</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--text-dim)]">
                    {p.activitiesDone ?? 0}/{p._count?.activities ?? 0}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      to={`/meal/projects/${p.id}`}
                      className="inline-flex text-[var(--text-dim)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
                    >
                      <IconNext className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
