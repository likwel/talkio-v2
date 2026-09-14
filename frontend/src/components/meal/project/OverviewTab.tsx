import type { Project } from '@/lib/types';
import { IconDashboard, IconWallet, IconCalendar, IconError, IconShield, IconForms } from '@/lib/icons';
import { Bar, KpiTile, SectionHeading, LEVELS, LEVEL_SHORT, money } from '@/components/meal/mealUi';

export default function OverviewTab({ project, goTab }: { project: Project; goTab: (t: string) => void }) {
  const cur = project.currency ?? 'USD';
  const indicators = project.indicators ?? [];
  const activities = project.activities ?? [];
  const bt = project.budgetTotals ?? { planned: 0, spent: 0, rate: null };
  const activitiesDone = activities.filter((a) => a.status === 'DONE').length;
  const activityPct = activities.length ? Math.round((activitiesDone / activities.length) * 100) : 0;
  const openRisks = (project.risks ?? []).filter((r) => r.status === 'OPEN').length;
  const pendingFeedback = (project.feedback ?? []).filter((f) => f.status === 'NEW' || f.status === 'IN_REVIEW').length;
  const formCount = project._count?.forms ?? 0;

  const byLevel = LEVELS.map((lvl) => {
    const items = indicators.filter((i) => i.level === lvl && i.progress != null);
    const avg = items.length ? Math.round(items.reduce((s, i) => s + (i.progress ?? 0), 0) / items.length) : null;
    return { lvl, count: indicators.filter((i) => i.level === lvl).length, avg };
  }).filter((x) => x.count > 0);

  const totalDisagg = indicators.reduce(
    (acc, i) => ({
      female: acc.female + (i.disagg?.female ?? 0),
      male: acc.male + (i.disagg?.male ?? 0),
      youth: acc.youth + (i.disagg?.youth ?? 0),
      disability: acc.disability + (i.disagg?.disability ?? 0),
    }),
    { female: 0, male: 0, youth: 0, disability: 0 },
  );
  const hasDisagg = totalDisagg.female || totalDisagg.male || totalDisagg.youth || totalDisagg.disability;

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconDashboard}
        tone="accent"
        title="Vue d'ensemble"
        subtitle="État du projet en un coup d'oeil — cliquez une tuile pour ouvrir le detail."
      />

      {project.goal && (
        <div className="card">
          <div className="field-label">Théorie du changement</div>
          <p className="whitespace-pre-wrap text-sm">{project.goal}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          icon={IconWallet}
          tone={(bt.rate ?? 0) > 100 ? 'red' : (bt.rate ?? 0) >= 90 ? 'amber' : 'sky'}
          label="Exécution budgetaire"
          value={bt.rate == null ? '—' : `${bt.rate}%`}
          sub={
            <>
              <span>{money(bt.spent, cur)} / {money(bt.planned, cur)}</span>
              {bt.planned > 0 && (
                <span className="mt-1 block">
                  <Bar pct={bt.rate ?? 0} tone={(bt.rate ?? 0) > 100 ? 'red' : (bt.rate ?? 0) >= 90 ? 'amber' : 'accent'} />
                </span>
              )}
            </>
          }
          onClick={() => goTab('budget')}
        />

        <KpiTile
          icon={IconCalendar}
          tone={activityPct >= 90 ? 'emerald' : activityPct >= 50 ? 'sky' : 'amber'}
          label="Activités terminees"
          value={`${activityPct}%`}
          sub={
            <>
              <span>{activitiesDone} / {activities.length}</span>
              {activities.length > 0 && (
                <span className="mt-1 block">
                  <Bar pct={activityPct} tone={activityPct >= 90 ? 'emerald' : activityPct >= 50 ? 'accent' : 'amber'} />
                </span>
              )}
            </>
          }
          onClick={() => goTab('workplan')}
        />

        <KpiTile
          icon={IconError}
          tone={openRisks ? 'amber' : 'emerald'}
          label="Risques ouverts"
          value={openRisks}
          sub={`${(project.risks ?? []).length} au registre`}
          onClick={() => goTab('accountability')}
        />

        <KpiTile
          icon={IconShield}
          tone={pendingFeedback ? 'amber' : 'emerald'}
          label="Retours en attente"
          value={pendingFeedback}
          sub={`${(project.feedback ?? []).length} au total`}
          onClick={() => goTab('accountability')}
        />

        <KpiTile
          icon={IconForms}
          tone="violet"
          label="Formulaires de collecte"
          value={formCount}
          sub="lie(s) au projet"
          onClick={() => goTab('collecte')}
        />
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <div className="field-label mb-0">Avancement du cadre logique</div>
          <button onClick={() => goTab('logframe')} className="text-2xs font-semibold text-[var(--accent-strong)] hover:underline">
            Ouvrir
          </button>
        </div>
        {byLevel.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Aucun indicateur defini.</p>
        ) : (
          <div className="space-y-2.5">
            {byLevel.map(({ lvl, count, avg }) => (
              <div key={lvl}>
                <div className="mb-1 flex items-center justify-between text-2xs">
                  <span className="font-semibold">{LEVEL_SHORT[lvl]} <span className="text-[var(--text-dim)]">· {count}</span></span>
                  <span className="text-[var(--text-dim)]">{avg == null ? 'sans cible' : `${avg}%`}</span>
                </div>
                <Bar pct={avg ?? 0} tone={(avg ?? 0) >= 90 ? 'emerald' : (avg ?? 0) >= 50 ? 'accent' : 'amber'} />
              </div>
            ))}
          </div>
        )}
      </div>

      {hasDisagg ? (
        <div className="card">
          <div className="field-label">Portée bénéficiaires (cumul des mesures)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Femmes" value={totalDisagg.female} />
            <Stat label="Hommes" value={totalDisagg.male} />
            <Stat label="Jeunes" value={totalDisagg.youth} />
            <Stat label="Situation de handicap" value={totalDisagg.disability} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3">
      <div className="text-lg font-bold">{value.toLocaleString('fr-FR')}</div>
      <div className="text-2xs text-[var(--text-dim)]">{label}</div>
    </div>
  );
}
