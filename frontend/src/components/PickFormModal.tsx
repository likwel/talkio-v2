import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FormDef } from '@/lib/types';
import Modal from '@/components/Modal';
import { IconSearch, IconForms, IconAdd } from '@/lib/icons';

const STATUS_LABEL: Record<FormDef['status'], string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  CLOSED: 'Fermé',
};

/** Choix d'un formulaire de l'espace a partager dans la conversation courante. */
export default function PickFormModal({
  open,
  workspaceId,
  onPick,
  onClose,
}: {
  open: boolean;
  workspaceId?: string;
  onPick: (formId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');

  const forms = useQuery({
    queryKey: ['forms', 'ws', workspaceId],
    enabled: open && !!workspaceId,
    queryFn: async () =>
      (await api.get<FormDef[]>('/forms', { params: { workspaceId } })).data,
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (forms.data ?? []).filter((f) => !s || f.title.toLowerCase().includes(s));
  }, [forms.data, q]);

  return (
    <Modal open={open} onClose={onClose} title="Partager un formulaire">
      <div className="relative mb-2">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher un formulaire…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {list.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => onPick(f.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <IconForms className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{f.title}</span>
                <span className="block truncate text-2xs text-[var(--text-dim)]">
                  {STATUS_LABEL[f.status]} · {f._count?.fields ?? f.fields?.length ?? 0} champ(s)
                </span>
              </span>
            </button>
          </li>
        ))}
        {forms.isLoading && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Chargement…</li>
        )}
        {!forms.isLoading && list.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-6 text-center text-sm text-[var(--text-dim)]">
            Aucun formulaire dans cet espace.
            <Link to="/forms/new" className="btn-primary btn-sm" onClick={onClose}>
              <IconAdd className="h-4 w-4" /> Créer un formulaire
            </Link>
          </li>
        )}
      </ul>
    </Modal>
  );
}
