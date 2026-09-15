import { useSearchParams } from 'react-router-dom';
import { IconAnalytics, IconKanban, IconForms, IconDashboard } from '@/lib/icons';
import PageHeader from '@/components/PageHeader';
import FilterSidebar from '@/components/FilterSidebar';
import ProjectsPanel from '@/components/meal/ProjectsPanel';
import FormsPanel from '@/components/meal/FormsPanel';
import PortfolioPanel from '@/components/meal/PortfolioPanel';

type Tab = 'dashboard' | 'projets' | 'forms';
const TABS: { id: Tab; label: string; Icon: typeof IconKanban }[] = [
  { id: 'dashboard', label: 'Tableau de bord', Icon: IconDashboard },
  { id: 'projets', label: 'Projets', Icon: IconKanban },
  { id: 'forms', label: 'Formulaires', Icon: IconForms },
];

/** Suivi-évaluation : tableau de bord portefeuille, projets (cadre logique, plan de
 *  travail, budget, redevabilité, apprentissage, rapports) + formulaires d'enquête. */
export default function Meal() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'forms' ? 'forms' : raw === 'dashboard' ? 'dashboard' : 'projets';
  const setTab = (t: Tab) => setParams(t === 'projets' ? {} : { tab: t }, { replace: true });

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={<IconAnalytics className="h-6 w-6 shrink-0 text-[var(--accent)]" />} title="Suivi-évaluation" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page max-w-8xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <FilterSidebar
              title={null}
              groups={[
                {
                  value: tab,
                  onChange: (k) => setTab(k as Tab),
                  items: TABS.map(({ id, label, Icon }) => ({
                    key: id,
                    label,
                    icon: <Icon className="h-4 w-4" />,
                  })),
                },
              ]}
            />
            <div className="min-w-0 flex-1">
              {tab === 'forms' ? <FormsPanel /> : tab === 'dashboard' ? <PortfolioPanel /> : <ProjectsPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
