import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import type { Channel, WorkspaceDetail } from '@/lib/types';
import { IconSearch, IconTick, IconGroups } from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
function tint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function NewConversationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Channel) => void;
}) {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const detail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: !!current && open,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });

  const members = useMemo(
    () => (detail.data?.members ?? []).map((m) => m.user).filter((u) => u.id !== user?.id),
    [detail.data, user?.id],
  );
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? members.filter((m) => m.fullName.toLowerCase().includes(s)) : members;
  }, [members, q]);

  const isGroup = selected.length > 1;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function create() {
    if (selected.length === 0 || !current) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api.post<Channel>('/channels/direct', {
        workspaceId: current.id,
        userIds: selected,
        name: isGroup ? name.trim() || undefined : undefined,
      });
      onCreated(r.data);
      setSelected([]);
      setName('');
      setQ('');
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? 'Creation impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle conversation"
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" onClick={create} disabled={busy || selected.length === 0}>
            {isGroup ? 'Creer le groupe' : 'Demarrer la conversation'}
          </button>
        </>
      }
    >
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50">{err}</div>}

      {isGroup && (
        <input
          className="input mb-3"
          placeholder="Nom du groupe (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}

      <div className="relative mb-2">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher une personne"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
        <IconGroups className="h-4 w-4" />
        {selected.length === 0
          ? 'Selectionnez une personne (ou plusieurs pour un groupe)'
          : `${selected.length} participant(s) selectionne(s)`}
      </p>

      <ul className="max-h-72 space-y-0.5 overflow-y-auto">
        {detail.isLoading && <li className="py-3 text-center text-sm text-[var(--text-dim)]">Chargement…</li>}
        {filtered.map((m) => {
          const on = selected.includes(m.id);
          return (
            <li key={m.id}>
              <button
                onClick={() => toggle(m.id)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition',
                  on ? 'bg-[var(--accent-soft)]' : 'hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: tint(m.id) }}
                >
                  {initials(m.fullName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.fullName}</span>
                <span
                  className={clsx(
                    'grid h-5 w-5 place-items-center rounded-md border',
                    on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--outline)]',
                  )}
                >
                  {on && <IconTick className="h-3.5 w-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
        {!detail.isLoading && filtered.length === 0 && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Personne a afficher</li>
        )}
      </ul>
    </Modal>
  );
}
