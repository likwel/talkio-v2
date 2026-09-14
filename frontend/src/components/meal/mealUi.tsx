import type { ReactNode, ComponentType } from 'react';
import clsx from 'clsx';
import type {
  Activity,
  ActivityStatus,
  FeedbackStatus,
  FeedbackType,
  LogframeLevel,
  ProjectHealth,
  ProjectStatus,
  RiskStatus,
} from '@/lib/types';

/** Libelles en langage clair (le sigle technique reste entre parentheses). */
export const LEVEL_LABEL: Record<LogframeLevel, string> = {
  IMPACT: 'Impact — changement durable visé (Impact)',
  OUTCOME: 'Résultat — effet a moyen terme (Outcome)',
  OUTPUT: 'Produit — livrable direct de l’action (Output)',
  ACTIVITY: 'Activité — action menée sur le terrain (Activity)',
};
export const LEVEL_SHORT: Record<LogframeLevel, string> = {
  IMPACT: 'Impact',
  OUTCOME: 'Résultat',
  OUTPUT: 'Produit',
  ACTIVITY: 'Activité',
};
export const LEVELS: LogframeLevel[] = ['IMPACT', 'OUTCOME', 'OUTPUT', 'ACTIVITY'];

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; cls: string }> = {
  ACTIVE: { label: 'En cours', cls: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  ON_HOLD: { label: 'En pause', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  COMPLETED: { label: 'Terminé', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  ARCHIVED: { label: 'Archive', cls: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
};

export const PROJECT_HEALTH: Record<ProjectHealth, { label: string; dot: string; cls: string }> = {
  ON_TRACK: { label: 'Sur la bonne voie', dot: 'bg-emerald-500', cls: 'text-emerald-600 dark:text-emerald-400' },
  AT_RISK: { label: 'À surveiller', dot: 'bg-amber-500', cls: 'text-amber-600 dark:text-amber-400' },
  OFF_TRACK: { label: 'En difficulté', dot: 'bg-red-500', cls: 'text-red-600 dark:text-red-400' },
};

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; cls: string }> = {
  PLANNED: { label: 'Planifiée', cls: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
  IN_PROGRESS: { label: 'En cours', cls: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  DONE: { label: 'Terminée', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  DELAYED: { label: 'En retard', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  CANCELLED: { label: 'Annulée', cls: 'bg-[var(--surface-2)] text-[var(--text-dim)] line-through' },
};

/** Couleur pleine (barres de chronologie / Gantt) — l'equivalent solide de ACTIVITY_STATUS. */
export const ACTIVITY_BAR_COLOR: Record<ActivityStatus, string> = {
  PLANNED: '#94a3b8',
  IN_PROGRESS: 'var(--accent)',
  DONE: '#10b981',
  DELAYED: '#ef4444',
  CANCELLED: '#cbd5e1',
};

/** Une date tombe-t-elle dans la période "2026" ou "2026-Q2" ? */
export function inPeriod(period: string, iso: string) {
  const d = new Date(iso);
  const [y, q] = period.split('-');
  if (Number(y) !== d.getFullYear()) return false;
  if (!q) return true;
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter}` === q;
}

/** Une activité est en retard si son échéance est depassee et qu'elle n'est ni terminée ni annulée. */
export function isOverdue(a: Pick<Activity, 'dueDate' | 'status'>): boolean {
  return !!a.dueDate && a.status !== 'DONE' && a.status !== 'CANCELLED' && new Date(a.dueDate) < new Date();
}

export const RISK_STATUS: Record<RiskStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Ouvert', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  MITIGATED: { label: 'Atténué', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  CLOSED: { label: 'Clos', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
};

export const FEEDBACK_TYPE: Record<FeedbackType, string> = {
  COMPLAINT: 'Plainte',
  SUGGESTION: 'Suggestion',
  QUESTION: 'Question',
  APPRECIATION: 'Appreciation',
};
export const FEEDBACK_STATUS: Record<FeedbackStatus, { label: string; cls: string }> = {
  NEW: { label: 'Nouveau', cls: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  IN_REVIEW: { label: 'En traitement', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  RESOLVED: { label: 'Résolu', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  CLOSED: { label: 'Clos', cls: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
};

const PROJECT_TINTS = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
/** Couleur deterministe (par id) pour les pastilles de projet — coherente dans toute l'app. */
export function projectTint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_TINTS[h % PROJECT_TINTS.length];
}

export function money(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString('fr-FR')} ${currency}`;
  }
}

export function riskScore(likelihood: number, impact: number) {
  const s = likelihood * impact;
  if (s >= 15) return { label: 'Critique', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  if (s >= 8) return { label: 'Eleve', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (s >= 4) return { label: 'Moyen', cls: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' };
  return { label: 'Faible', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

/** Liste de périodes utiles pour les cibles / rapports (année courante +/- 1). */
export function periodOptions(): { value: string; label: string }[] {
  const y = new Date().getFullYear();
  const out: { value: string; label: string }[] = [];
  for (const year of [y, y + 1, y - 1]) {
    out.push({ value: String(year), label: `Année ${year}` });
    for (const q of [1, 2, 3, 4]) out.push({ value: `${year}-Q${q}`, label: `T${q} ${year}` });
  }
  return out;
}

export function Bar({ pct, tone = 'accent' }: { pct: number; tone?: 'accent' | 'amber' | 'red' | 'emerald' }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const bg =
    tone === 'red'
      ? 'bg-red-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'emerald'
          ? 'bg-emerald-500'
          : 'bg-[var(--accent)]';
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className={`h-full rounded-full ${bg} transition-[width]`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ' + className
      }
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

const TONE_BADGE: Record<string, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
};

/** En-tête de section uniforme : pastille d'icône teintée + titre + sous-titre + action. */
export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  tone = 'accent',
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: ReactNode;
  tone?: keyof typeof TONE_BADGE;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONE_BADGE[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--text-dim)]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Tuile chiffrée pour tableaux de bord : icône teintée, valeur, libellé, sous-texte optionnel. */
export function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'accent',
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof TONE_BADGE;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={clsx(
        'card-elevated group flex items-start gap-3 text-left transition',
        onClick && 'hover:-translate-y-0.5 hover:shadow-elevation-2',
      )}
    >
      <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', TONE_BADGE[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
        <span className="block text-xl font-bold leading-tight">{value}</span>
        {sub && <span className="mt-0.5 block text-2xs text-[var(--text-dim)]">{sub}</span>}
      </span>
    </Comp>
  );
}
