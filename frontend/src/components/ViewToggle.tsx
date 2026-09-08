import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { IconGrid, IconList } from '@/lib/icons';

export type ViewMode = 'grid' | 'list';

/** Etat de vue Grille/Liste persiste dans localStorage sous `talkio.view.<key>`. */
export function useViewMode(key: string): [ViewMode, (v: ViewMode) => void] {
  const storeKey = `talkio.view.${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(storeKey) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, mode);
    } catch {
      /* ignore */
    }
  }, [storeKey, mode]);
  return [mode, setMode];
}

export default function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-[var(--outline)] p-0.5">
      {(
        [
          ['grid', 'Grille', IconGrid],
          ['list', 'Liste', IconList],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          title={label}
          aria-label={label}
          aria-pressed={value === v}
          className={clsx(
            'grid h-7 w-8 place-items-center rounded-md transition',
            value === v ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
