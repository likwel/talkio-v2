import clsx from 'clsx';
import PresenceDot from '@/components/PresenceDot';
import type { PresenceDotState } from '@/context/PresenceContext';

const AV_COLORS = [
  '#0cae36',
  '#2563eb',
  '#d946ef',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#8b5cf6',
  '#ec4899',
];

/** Couleur de repli déterministe (quand il n'y a pas de photo). */
export function avatarColor(id?: string | null): string {
  if (!id) return AV_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function avatarInitials(name?: string | null): string {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

interface Props {
  /** Sert à la couleur de repli et à la clé de teinte. */
  id?: string | null;
  name?: string | null;
  /** Photo de profil (avatarUrl). Si absente → initiales sur fond teinté. */
  src?: string | null;
  /** Taille en pixels. */
  size?: number;
  status?: PresenceDotState;
  /** Couleur de l'anneau autour de la pastille de présence. */
  ring?: string;
  /** Coins arrondis « carré » (rounded-xl) au lieu du cercle. */
  square?: boolean;
  className?: string;
}

/** Avatar unifié : affiche la photo de profil si disponible, sinon les initiales. */
export default function Avatar({
  id,
  name,
  src,
  size = 36,
  status,
  ring,
  square,
  className,
}: Props) {
  const radius = square ? 'rounded-xl' : 'rounded-full';
  return (
    <span
      className={clsx('relative inline-block shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? ''}
          className={clsx('h-full w-full object-cover', radius)}
          draggable={false}
        />
      ) : (
        <span
          className={clsx('grid h-full w-full place-items-center font-semibold text-white', radius)}
          style={{ background: avatarColor(id), fontSize: Math.round(size * 0.4) }}
        >
          {avatarInitials(name)}
        </span>
      )}
      {status && (
        <PresenceDot
          state={status}
          size={Math.max(8, Math.round(size * 0.28))}
          ring={ring}
          className="absolute bottom-0 right-0"
        />
      )}
    </span>
  );
}
