import { useMemo, useState } from 'react';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import Avatar from '@/components/Avatar';
import { IconSearch, IconAdd, IconTick } from '@/lib/icons';

export default function WorkspacesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orderedWorkspaces, current, setCurrent, reload } = useWorkspace();
  const dialog = useDialog();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? orderedWorkspaces.filter((w) => w.name.toLowerCase().includes(s)) : orderedWorkspaces;
  }, [orderedWorkspaces, q]);

  async function create() {
    const name = await dialog.prompt({
      title: 'Nouvel espace de travail',
      label: 'Nom',
      placeholder: 'Mon equipe',
      confirmLabel: 'Creer',
    });
    if (!name?.trim()) return;
    await api.post('/workspaces', { name: name.trim() });
    await reload();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Espaces de travail (${orderedWorkspaces.length})`}
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-primary" onClick={create}>
            <IconAdd className="h-4 w-4" /> Nouvel espace
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher un espace"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="space-y-1">
        {list.map((w) => (
          <li key={w.id}>
            <button
              onClick={() => {
                setCurrent(w);
                onClose();
              }}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5',
                w.id === current?.id && 'bg-[var(--accent-soft)]',
              )}
            >
              <Avatar id={w.id} name={w.name} src={w.imageUrl} square size={36} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{w.name}</span>
              {w.id === current?.id && <IconTick className="h-4 w-4 text-[var(--accent)]" />}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-4 text-center text-sm text-[var(--text-dim)]">Aucun resultat</li>}
      </ul>
    </Modal>
  );
}
