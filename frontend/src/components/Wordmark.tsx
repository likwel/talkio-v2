import clsx from 'clsx';

/**
 * Identite visuelle Talkio.
 *
 * - `TalkioMark` : l'icone applicative (carre noir arrondi, « t » blanc,
 *   bulle de discussion rose #FF2C5F). Autonome, lisible sur tout fond.
 * - `LogoBadge` : `TalkioMark` dimensionne pour les barres de navigation.
 * - `Wordmark` : le logo mot « talkio » (image). En mode sombre on bascule sur
 *   la version fond noir avec `mix-blend-mode: screen` pour effacer le noir et
 *   ne garder que le lettrage clair + la bulle rose.
 */

const SIZES = {
  sm: { wordmark: 'h-6', px: 30 },
  md: { wordmark: 'h-7', px: 34 },
  lg: { wordmark: 'h-9', px: 44 },
  xl: { wordmark: 'h-12', px: 56 },
} as const;

// Dimensions natives des fichiers (pour figer le ratio et empecher l'effondrement
// de la largeur sur Chromium/Edge quand l'image est un enfant flex).
const NOBG = { w: 694, h: 359 };
const BLACK = { w: 1743, h: 902 };

type Size = keyof typeof SIZES;

export function TalkioMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      role="img"
      aria-label="Talkio"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="#101215"
        stroke="rgba(148,163,184,0.4)"
        strokeWidth="1"
      />
      <path
        d="M15.1 6.4h4.3v3.5h3.4v3.9h-3.4v5.7c0 1.2.5 1.8 1.6 1.8.7 0 1.3-.1 1.8-.4v3.9c-.8.4-1.9.6-3.2.6-3.1 0-4.9-1.7-4.9-5.2v-6.4h-2.4V9.9h2.4z"
        fill="#ffffff"
      />
      <path
        d="M20.7 2.6h6.2c1.6 0 2.9 1.3 2.9 2.9v3.1c0 1.6-1.3 2.9-2.9 2.9h-2.2l-2.7 2.2c-.4.3-1 0-1-.5v-1.7h-.3c-1.6 0-2.9-1.3-2.9-2.9V5.5c0-1.6 1.3-2.9 2.9-2.9z"
        fill="#FF2C5F"
      />
    </svg>
  );
}

export function LogoBadge({ size = 'md', className }: { size?: Size; className?: string }) {
  return <TalkioMark size={SIZES[size].px} className={className} />;
}

/**
 * Variante du logo pour un fond SOMBRE fixe (pied de page de la landing) :
 * l'image « logo_black » (lettrage clair + bulle rose sur fond noir), le noir
 * etant efface par `mix-blend-mode: screen`. Dimensionne pour rester lisible.
 */
const ON_DARK_H = { sm: 'h-7', md: 'h-9', lg: 'h-11', xl: 'h-14' } as const;

export function WordmarkOnDark({ size = 'md', className }: { size?: Size; className?: string }) {
  return (
    <span className={clsx('inline-block select-none align-middle', ON_DARK_H[size], className)}>
      <img
        src="/logo_black.png"
        alt="Talkio"
        width={BLACK.w}
        height={BLACK.h}
        className="block h-full w-auto max-w-none mix-blend-screen"
        draggable={false}
      />
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
  const h = SIZES[size].wordmark;
  // La hauteur est portee par le conteneur ; chaque image fait `h-full`, ce qui
  // evite les effondrements de dimension (Chromium/Edge, bascule display:none).
  const mark = (
    <span
      role="img"
      aria-label="Talkio"
      className={clsx('inline-block shrink-0 select-none align-middle', h, className)}
    >
      {/* Clair : logo a fond transparent */}
      <img
        src="/logo_nobg.png"
        alt=""
        width={NOBG.w}
        height={NOBG.h}
        className="block h-full w-auto max-w-none dark:hidden"
        draggable={false}
      />
      {/* Sombre : logo fond noir, le noir est efface par le mode de fusion */}
      <img
        src="/logo_nobg.png"
        alt=""
        width={BLACK.w}
        height={BLACK.h}
        className="hidden h-full w-auto max-w-none mix-blend-screen dark:block"
        draggable={false}
      />
    </span>
  );
  if (!withBadge) return mark;
  return (
    <span className="flex items-center gap-2.5">
      <LogoBadge size={size} />
      {mark}
    </span>
  );
}
