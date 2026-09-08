import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { PRESENCE_OPTIONS, DOT_COLOR } from '@/context/PresenceContext';
import { IconTick } from '@/lib/icons';

/**
 * Selecteur de statut de presence — application immediate (`PATCH /users/me/status`).
 * `compact` : version pour un menu deroulant / popover au survol.
 */
export default function StatusPicker({
  compact,
  onPick,
}: {
  compact?: boolean;
  onPick?: () => void;
}) {
  const { user, setStatus } = useAuth();
  const current = user?.presenceStatus ?? 'ONLINE';

  const choose = (v: (typeof PRESENCE_OPTIONS)[number]['value']) => {
    setStatus(v).catch(() => undefined);
    onPick?.();
  };

  if (compact) {
    return (
      <div className="flex flex-col">
        <div className="px-2 pb-1 pt-1 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
          Statut
        </div>
        {PRESENCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className={clsx(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-[var(--surface-2)]',
              current === o.value && 'font-semibold text-[var(--accent-strong)]',
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT_COLOR[o.dot] }} />
            <span className="flex-1">{o.label}</span>
            {current === o.value && <IconTick className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-display text-md font-bold">Statut</h3>
      <p className="mb-3 text-sm text-[var(--text-dim)]">
        Applique immediatement. « Invisible » : vous apparaissez hors ligne pour les autres.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRESENCE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
              current === o.value
                ? 'border-[var(--accent)] accent-active'
                : 'border-[var(--outline)] text-[var(--text-dim)] hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT_COLOR[o.dot] }} />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
