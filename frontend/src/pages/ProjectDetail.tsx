import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Project, ProjectHealth, ProjectStatus } from '@/lib/types';
import { IconBack, IconWallet, IconPlace, IconCalendar, IconChevronDown } from '@/lib/icons';
import Select from '@/components/Select';
import PageHeader from '@/components/PageHeader';
import { PROJECT_HEALTH, PROJECT_STATUS } from '@/components/meal/mealUi';
import OverviewTab from '@/components/meal/project/OverviewTab';
import LogframeTab from '@/components/meal/project/LogframeTab';
import FormsTab from '@/components/meal/project/FormsTab';
import QuipsTab from '@/components/meal/project/QuipsTab';
import TranscriptsTab from '@/components/meal/project/TranscriptsTab';
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
    tabs: [
      { id: 'collecte', label: 'Collecte' },
      { id: 'quips', label: 'Enquêtes qualitatives' },
      { id: 'transcripts', label: 'Entretiens qualitatifs' },
    ],
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

/**
 * Sidebar de navigation du projet : les 5 phases MEAL en menu/sous-menu
 * repliable (accordéon) — la phase contenant l'onglet actif se déplie
 * automatiquement, les autres restent repliées pour gagner de la place.
 */
function PhaseSidebar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const activePhase = PHASES.find((ph) => ph.tabs.some((t) => t.id === tab))?.n ?? 1;
  const [openPhases, setOpenPhases] = useState<Set<number>>(() => new Set([activePhase]));

  useEffect(() => {
    setOpenPhases((s) => (s.has(activePhase) ? s : new Set(s).add(activePhase)));
  }, [activePhase]);

  function togglePhase(n: number) {
    setOpenPhases((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  return (
    <nav className="w-full shrink-0 space-y-1 rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-2 sm:w-64">
      {PHASES.map((ph) => {
        const isOpen = openPhases.has(ph.n);
        const phaseActive = ph.tabs.some((t) => t.id === tab);
        return (
          <div key={ph.n}>
            <button
              type="button"
              onClick={() => togglePhase(ph.n)}
              title={ph.hint}
              className={clsx(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition',
                phaseActive ? 'text-[var(--text)]' : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
              )}
            >
              <span
                className={clsx(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors',
                  phaseActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-dim)]',
                )}
              >
                {ph.n}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider">{ph.name}</span>
              <IconChevronDown className={clsx('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="ml-[13px] mt-0.5 space-y-0.5 border-l border-[var(--outline)] py-0.5 pl-3.5">
                {ph.tabs.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={clsx(
                        'relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition',
                        active
                          ? 'accent-active'
                          : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                      )}
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

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

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={
          <Link to="/meal" className="icon-btn -ml-1 shrink-0" aria-label="Retour">
            <IconBack className="h-5 w-5" />
          </Link>
        }
        title={p.name}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page max-w-8xl space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--outline)] pb-4 text-xs text-[var(--text-dim)]">
            {p.code && <span className="chip shrink-0">{p.code}</span>}
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
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span
                className={clsx('inline-flex items-center gap-1.5 text-2xs font-semibold', PROJECT_HEALTH[health].cls)}
              >
                <span className={clsx('h-2 w-2 rounded-full', PROJECT_HEALTH[health].dot)} />
                {PROJECT_HEALTH[health].label}
              </span>
              <Select
                className="h-9 w-36 shrink-0"
                aria-label="Statut du projet"
                value={status}
                onChange={(v) => patchProject({ status: v as ProjectStatus })}
                options={STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))}
              />
              <Select
                className="h-9 w-48 shrink-0"
                aria-label="Santé du projet"
                value={health}
                onChange={(v) => patchProject({ health: v as ProjectHealth })}
                options={HEALTHS.map((h) => ({ value: h, label: PROJECT_HEALTH[h].label }))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <PhaseSidebar tab={tab} setTab={setTab} />
            <div className="min-w-0 flex-1 space-y-5">
              {tab === 'overview' && <OverviewTab project={p} goTab={setTab} />}
              {tab === 'logframe' && <LogframeTab project={p} reload={reload} />}
              {tab === 'collecte' && <FormsTab project={p} />}
              {tab === 'quips' && <QuipsTab project={p} reload={reload} />}
              {tab === 'transcripts' && <TranscriptsTab project={p} reload={reload} />}
              {tab === 'workplan' && <WorkplanTab project={p} reload={reload} />}
              {tab === 'budget' && <BudgetTab project={p} reload={reload} />}
              {tab === 'analyse' && <AnalyseTab project={p} />}
              {tab === 'accountability' && <AccountabilityTab project={p} reload={reload} />}
              {tab === 'learning' && <LearningTab project={p} reload={reload} />}
              {tab === 'reports' && <ReportsTab project={p} reload={reload} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
