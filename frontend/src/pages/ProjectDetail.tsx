import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Project, ProjectHealth, ProjectStatus } from '@/lib/types';
import { IconBack, IconWallet, IconPlace, IconCalendar } from '@/lib/icons';
import Select from '@/components/Select';
import { PROJECT_HEALTH, PROJECT_STATUS, projectTint } from '@/components/meal/mealUi';
import OverviewTab from '@/components/meal/project/OverviewTab';
import LogframeTab from '@/components/meal/project/LogframeTab';
import FormsTab from '@/components/meal/project/FormsTab';
import WorkplanTab from '@/components/meal/project/WorkplanTab';
import BudgetTab from '@/components/meal/project/BudgetTab';
import AnalyseTab from '@/components/meal/project/AnalyseTab';
import AccountabilityTab from '@/components/meal/project/AccountabilityTab';
import LearningTab from '@/components/meal/project/LearningTab';
import ReportsTab from '@/components/meal/project/ReportsTab';

/**
 * Cycle MEAL en 5 phases (Designing -> Planning -> Collecting -> Analysing -> Using) :
 * chaque phase regroupe les onglets qui la concretisent dans l'outil.
 */
const PHASES = [
  {
    n: 1,
    name: 'Conception',
    hint: 'Théorie du changement, cadre de résultats, cadre logique',
    tabs: [
      { id: 'overview', label: 'Vue d’ensemble' },
      { id: 'logframe', label: 'Cadre logique' },
    ],
  },
  {
    n: 2,
    name: 'Planification',
    hint: 'Plan de travail, budget, alignement agenda',
    tabs: [
      { id: 'workplan', label: 'Plan de travail' },
      { id: 'budget', label: 'Budget' },
    ],
  },
  {
    n: 3,
    name: 'Collecte',
    hint: 'Formulaires et données de terrain',
    tabs: [{ id: 'collecte', label: 'Collecte' }],
  },
  {
    n: 4,
    name: 'Analyse',
    hint: 'Tendances, qualité des données, prévu vs réalisé',
    tabs: [{ id: 'analyse', label: 'Analyse' }],
  },
  {
    n: 5,
    name: 'Utilisation',
    hint: 'Rapports, décisions, redevabilité, apprentissage',
    tabs: [
      { id: 'reports', label: 'Rapports' },
      { id: 'accountability', label: 'Redevabilité' },
      { id: 'learning', label: 'Apprentissage' },
    ],
  },
];
const TABS = PHASES.flatMap((ph) => ph.tabs);

const STATUSES: ProjectStatus[] = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
const HEALTHS: ProjectHealth[] = ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('t')) ? params.get('t')! : 'overview';
  const setTab = (t: string) => setParams(t === 'overview' ? {} : { t }, { replace: true });

  const project = useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => (await api.get<Project>(`/meal/projects/${projectId}`)).data,
  });

  const reload = () => project.refetch();

  async function patchProject(data: Partial<Project>) {
    await api.patch(`/meal/projects/${projectId}`, data);
    project.refetch();
  }

  const p = project.data;
  const period = useMemo(() => {
    if (!p?.startDate && !p?.endDate) return null;
    const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '…');
    return `${fmt(p?.startDate)} → ${fmt(p?.endDate)}`;
  }, [p?.startDate, p?.endDate]);

  if (project.isLoading) return <div className="page max-w-8xl text-[var(--text-dim)]">Chargement…</div>;
  if (!p) return <div className="page max-w-8xl">Projet introuvable</div>;

  const status = p.status ?? 'ACTIVE';
  const health = p.health ?? 'ON_TRACK';

  const tint = projectTint(p.id);
  const initials = (p.code || p.name).slice(0, 2).toUpperCase();

  return (
    <div className="page max-w-8xl space-y-5">
      <Link
        to="/meal"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--text-dim)] transition hover:text-[var(--text)]"
      >
        <IconBack className="h-4 w-4" /> Suivi-évaluation
      </Link>

      <div className="card-elevated relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${tint}, var(--accent))` }}
        />
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold text-white shadow-elevation-1"
            style={{ background: tint }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
                {p.name}
              </h1>
              {p.code && <span className="chip shrink-0">{p.code}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-dim)]">
              {p.donor && (
                <span className="flex items-center gap-1">
                  <IconWallet className="h-3.5 w-3.5 shrink-0" /> {p.donor}
                </span>
              )}
              {p.sector && <span>{p.sector}</span>}
              {p.location && (
                <span className="flex items-center gap-1">
                  <IconPlace className="h-3.5 w-3.5 shrink-0" /> {p.location}
                </span>
              )}
              {period && (
                <span className="flex items-center gap-1">
                  <IconCalendar className="h-3.5 w-3.5 shrink-0" /> {period}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select
                className="w-36"
                aria-label="Statut du projet"
                value={status}
                onChange={(v) => patchProject({ status: v as ProjectStatus })}
                options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))}
              />
              <Select
                className="w-48"
                aria-label="Santé du projet"
                value={health}
                onChange={(v) => patchProject({ health: v as ProjectHealth })}
                options={HEALTHS.map((h) => ({ value: h, label: PROJECT_HEALTH[h].label }))}
              />
            </div>
            <span
              className={clsx('inline-flex items-center gap-1.5 text-2xs font-semibold', PROJECT_HEALTH[health].cls)}
            >
              <span className={clsx('h-2 w-2 rounded-full', PROJECT_HEALTH[health].dot)} />
              {PROJECT_HEALTH[health].label}
            </span>
          </div>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto border-b border-[var(--outline)] pb-2">
        <div className="flex items-start gap-1 px-1">
          {PHASES.map((ph, i) => (
            <div
              key={ph.n}
              className={clsx('flex shrink-0 flex-col gap-1 px-2', i > 0 && 'border-l border-[var(--outline)]')}
            >
              <span
                className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]"
                title={ph.hint}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[9px] font-bold text-[var(--accent-strong)]">
                  {ph.n}
                </span>
                {ph.name}
              </span>
              <div className="flex gap-1">
                {ph.tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-semibold transition',
                      tab === t.id
                        ? 'accent-active'
                        : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {tab === 'overview' && <OverviewTab project={p} goTab={setTab} />}
      {tab === 'logframe' && <LogframeTab project={p} reload={reload} />}
      {tab === 'collecte' && <FormsTab project={p} />}
      {tab === 'workplan' && <WorkplanTab project={p} reload={reload} />}
      {tab === 'budget' && <BudgetTab project={p} reload={reload} />}
      {tab === 'analyse' && <AnalyseTab project={p} />}
      {tab === 'accountability' && <AccountabilityTab project={p} reload={reload} />}
      {tab === 'learning' && <LearningTab project={p} reload={reload} />}
      {tab === 'reports' && <ReportsTab project={p} reload={reload} />}
    </div>
  );
}
