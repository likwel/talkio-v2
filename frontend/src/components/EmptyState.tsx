import type { ReactNode } from 'react';

/** Etat vide uniforme pour les pages d'accueil (Projet / MEAL / Collecte…). */
export default function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--outline)] bg-[var(--surface)] px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-dim)]">
        {icon}
      </span>
      <div>
        <div className="font-semibold">{title}</div>
        {hint && <div className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-dim)]">{hint}</div>}
      </div>
      {action}
    </div>
  );
}
