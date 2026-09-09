import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { api } from '@/lib/api';
import Avatar from '@/components/Avatar';
import WorkspacesModal from '@/components/WorkspacesModal';
import { IconChevronDown, IconAdd, IconSettings, IconTick } from '@/lib/icons';

/**
 * Sélecteur d'espace — propre à la messagerie. Le reste de l'app
 * (Projet / MEAL / Collecte) ne dépend plus de l'espace actif.
 */
export default function WorkspaceSwitcher() {
  const { orderedWorkspaces, current, setCurrent, reload } = useWorkspace();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  async function createWorkspace() {
    setOpen(false);
    const name = await dialog.prompt({
      title: 'Nouvel espace',
      label: 'Nom',
      placeholder: 'Mon équipe',
      confirmLabel: 'Créer',
    });
    if (!name?.trim()) return;
    const r = await api.post('/workspaces', { name: name.trim() });
    await reload();
    if (r.data?.id) {
      const w = { id: r.data.id, name: r.data.name, slug: r.data.slug };
      setCurrent(w as never);
    }
  }

  return (
    <div className="relative min-w-0 flex-1" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-[var(--surface-2)]"
        title="Changer d'espace"
      >
        <Avatar id={current?.id} name={current?.name} src={current?.imageUrl} square size={24} />
        <span className="min-w-0 flex-1 truncate font-display text-md font-bold">
          {current?.name ?? 'Espace'}
        </span>
        <IconChevronDown className={clsx('h-4 w-4 shrink-0 text-[var(--text-dim)] transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-xl border border-[var(--outline)] bg-[var(--surface)] py-1 shadow-elevation-3">
          <div className="max-h-64 overflow-y-auto">
            {orderedWorkspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setCurrent(w);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
              >
                <Avatar id={w.id} name={w.name} src={w.imageUrl} square size={22} />
                <span className="min-w-0 flex-1 truncate">
                  {w.name}
                  {w.isPersonal && (
                    <span className="ml-1 text-2xs text-[var(--text-dim)]">· personnel</span>
                  )}
                </span>
                {w.id === current?.id && <IconTick className="h-4 w-4 shrink-0 text-[var(--accent)]" />}
              </button>
            ))}
          </div>
          <div className="mt-1 border-t border-[var(--outline)] pt-1">
            <button
              onClick={createWorkspace}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
            >
              <IconAdd className="h-4 w-4" /> Nouvel espace
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setManage(true);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
            >
              <IconSettings className="h-4 w-4" /> Gérer les espaces
            </button>
          </div>
        </div>
      )}

      <WorkspacesModal open={manage} onClose={() => setManage(false)} />
    </div>
  );
}
