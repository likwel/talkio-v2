import clsx from 'clsx';
import { ACCENT_PRESETS } from '@/context/ThemeContext';
import { IconTick } from '@/lib/icons';

interface Props {
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
  /** Autoriser « aucune » (revient a la couleur par defaut). */
  allowNone?: boolean;
  presets?: string[];
}

export default function ColorPicker({ value, onChange, allowNone, presets = ACCENT_PRESETS }: Props) {
  const norm = (value ?? '').toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Par defaut"
          className={clsx(
            'grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-bold text-[var(--text-dim)]',
            !value ? 'border-[var(--accent)]' : 'border-[var(--outline)]',
          )}
        >
          Auto
        </button>
      )}
      {presets.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          title={hex}
          className={clsx(
            'grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition',
            norm === hex.toLowerCase() ? 'ring-2 ring-[var(--text)]' : 'hover:scale-110',
          )}
          style={{ background: hex }}
        >
          {norm === hex.toLowerCase() && <IconTick className="h-4 w-4 text-white" />}
        </button>
      ))}
      <label
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-dashed border-[var(--outline)] text-xs text-[var(--text-dim)]"
        title="Couleur personnalisee"
      >
        +
        <input
          type="color"
          className="sr-only"
          value={/^#[0-9a-f]{6}$/i.test(norm) ? norm : '#0cae36'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
