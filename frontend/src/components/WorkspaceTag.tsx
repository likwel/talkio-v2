import type { WorkspaceRef } from '@/lib/types';
import Select from '@/components/Select';

/** Petite étiquette d'espace affichée sur les cartes Projet / MEAL / Collecte. */
export default function WorkspaceTag({ ws, className }: { ws?: WorkspaceRef | null; className?: string }) {
  if (!ws) return null;
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-2xs font-medium text-[var(--text-dim)] ' +
        (className ?? '')
      }
      title={`Espace : ${ws.name}`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: ws.color || 'var(--accent)' }}
      />
      <span className="max-w-[120px] truncate">{ws.isPersonal ? 'Personnel' : ws.name}</span>
    </span>
  );
}

/** Sélecteur d'espace cible à la création (Projet / MEAL / Collecte). */
export function WorkspacePicker({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string; isPersonal?: boolean }[];
  className?: string;
}) {
  if (options.length <= 1) return null;
  return (
    <label className={className}>
      <span className="field-label">Espace</span>
      <Select
        aria-label="Espace"
        searchable
        value={value}
        onChange={onChange}
        options={options.map((w) => ({ value: w.id, label: w.isPersonal ? 'Personnel' : w.name }))}
      />
    </label>
  );
}
