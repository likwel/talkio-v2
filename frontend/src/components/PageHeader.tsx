import type { ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  /** Icône déjà dimensionnée, ex. <IconKanban className="h-6 w-6 shrink-0 text-[var(--accent)]" />. */
  icon?: ReactNode;
  title: string;
  /** Actions alignées à droite (boutons…). */
  children?: ReactNode;
  className?: string;
}

/**
 * En-tête de page unifié (même gabarit que la barre de l'Agenda) :
 * bande bordée, icône + titre `font-display text-lg / sm:text-xl`, actions à droite.
 */
export default function PageHeader({ icon, title, children, className }: Props) {
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center gap-2 border-b border-[var(--outline)] px-3 py-2 sm:px-4',
        className,
      )}
    >
      {icon}
      <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-[var(--text)] sm:text-xl">
        {title}
      </h1>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}
