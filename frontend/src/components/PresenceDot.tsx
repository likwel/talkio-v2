import { DOT_COLOR, DOT_LABEL, type PresenceDotState } from '@/context/PresenceContext';

/** Pastille de statut, a superposer en bas a droite d'un avatar. */
export default function PresenceDot({
  state,
  size = 10,
  ring = 'var(--surface)',
  className,
}: {
  state: PresenceDotState;
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span
      title={DOT_LABEL[state]}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: DOT_COLOR[state],
        boxShadow: `0 0 0 2px ${ring}`,
        display: 'block',
      }}
    />
  );
}
