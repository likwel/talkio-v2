import type { ReactNode } from 'react';
import clsx from 'clsx';
import { IconFilter } from '@/lib/icons';

export interface FilterItem {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface FilterGroup {
  title?: string;
  value: string;
  onChange: (key: string) => void;
  items: FilterItem[];
}

/**
 * Panneau de filtres en liste verticale : un ou plusieurs groupes de boutons
 * empilés dans une carte bordée, indicateur d'état actif façon menu latéral
 * (barre d'accent + fond `accent-active`). Empilé au-dessus du contenu sur
 * mobile, en colonne fixe à gauche à partir de `sm:`.
 */
export default function FilterSidebar({
  groups,
  className,
  title = 'Filtres',
  onReset,
}: {
  groups: FilterGroup[];
  className?: string;
  /** Titre affiché en tête du panneau. `null` pour le masquer. */
  title?: string | null;
  /** Affiche un bouton « Réinitialiser » quand fourni (ex. si un filtre est actif). */
  onReset?: () => void;
}) {
  return (
    <nav
      className={clsx(
        'w-full shrink-0 rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-3 sm:w-56',
        className,
      )}
    >
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
            <IconFilter className="h-4 w-4" /> {title}
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-2xs font-semibold text-[var(--accent)] transition hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}
      <div className="space-y-3.5">
        {groups.map((g, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="mb-3.5 h-px bg-[var(--outline)]/60" />}
            {g.title && (
              <div className="mb-1.5 px-2 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                {g.title}
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = g.value === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => g.onChange(it.key)}
                    aria-pressed={active}
                    className={clsx(
                      'relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                      active
                        ? 'accent-active'
                        : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                      )}
                      {it.icon}
                      <span className="truncate">{it.label}</span>
                    </span>
                    {it.count != null && (
                      <span
                        className={clsx(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none',
                          active ? 'bg-white/60 text-[var(--accent-strong)] dark:bg-black/20' : 'text-[var(--text-dim)]',
                        )}
                      >
                        {it.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
