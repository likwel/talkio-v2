import clsx from 'clsx';

/**
 * Marque « Talkio » : « Talk » en couleur de texte pleine, « io » en degrade
 * accent -> violet (bg-clip-text). Deux styles distincts, un seul mot.
 */
const SIZES = {
  sm: { text: 'text-base', badge: 'h-8 w-8 rounded-lg text-sm' },
  md: { text: 'text-lg', badge: 'h-9 w-9 rounded-xl text-base' },
  lg: { text: 'text-2xl', badge: 'h-11 w-11 rounded-2xl text-lg' },
} as const;

type Size = keyof typeof SIZES;

export function LogoBadge({ size = 'md', className }: { size?: Size; className?: string }) {
  return (
    <span
      className={clsx(
        'grid shrink-0 place-items-center bg-gradient-to-br from-[var(--accent)] to-[#8774e1]',
        'font-display font-black text-white shadow-[0_2px_10px_var(--accent-ring)]',
        SIZES[size].badge,
        className,
      )}
    >
      T
    </span>
  );
}

export default function Wordmark({
  size = 'md',
  withBadge = false,
  className,
}: {
  size?: Size;
  withBadge?: boolean;
  className?: string;
}) {
  const mark = (
    <span className={clsx('font-display font-bold tracking-[-0.03em]', SIZES[size].text, className)}>
      <span className="text-[var(--text)]">Talk</span>
      <span className="bg-gradient-to-br from-[var(--accent)] to-[#8774e1] bg-clip-text italic text-transparent">
        io
      </span>
    </span>
  );
  if (!withBadge) return mark;
  return (
    <span className="flex items-center gap-2">
      <LogoBadge size={size} />
      {mark}
    </span>
  );
}
