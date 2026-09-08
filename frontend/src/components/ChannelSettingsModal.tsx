import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProfile } from '@/context/ProfileContext';
import type { Channel, WorkspaceDetail } from '@/lib/types';
import { IconAdd, IconClose, IconSearch } from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('');

export default function ChannelSettingsModal({
  channel,
  open,
  onClose,
  onChanged,
}: {
  channel: Channel | undefined;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { current } = useWorkspace();
  const { openProfile } = useProfile();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (channel) {
      setName(channel.name ?? '');
      setTopic(channel.topic ?? '');
      setColor(channel.color ?? null);
    }
  }, [channel?.id, open]);

  const detail = useQuery({
    queryKey: ['channel', channel?.id],
    enabled: open && !!channel,
    queryFn: async () => (await api.get<Channel>(`/channels/${channel!.id}`)).data,
  });
  const wsDetail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && addOpen && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });

  const members = detail.data?.members ?? channel?.members ?? [];
  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const isDirect = channel?.type === 'DIRECT';

  async function save() {
    if (!channel) return;
    await api.patch(`/channels/${channel.id}`, {
      name: isDirect ? undefined : name.trim() || null,
      topic: topic.trim() || null,
      color,
    });
    onChanged();
    onClose();
  }

  async function addMembers(ids: string[]) {
    if (!channel || ids.length === 0) return;
    await api.post(`/channels/${channel.id}/members`, { userIds: ids });
    detail.refetch();
    onChanged();
  }
  async function removeMember(uid: string) {
    if (!channel) return;
    await api.delete(`/channels/${channel.id}/members/${uid}`);
    detail.refetch();
    onChanged();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isDirect ? 'Parametres de la conversation' : 'Parametres du salon'}
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-primary" onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!isDirect && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Nom</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Sujet</span>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optionnel" />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">Couleur</span>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Membres ({members.length})
            </span>
            {!isDirect && (
              <button className="icon-btn-sm" onClick={() => setAddOpen((v) => !v)} aria-label="Ajouter">
                <IconAdd className="h-4 w-4" />
              </button>
            )}
          </div>

          {addOpen && (
            <div className="mb-2 rounded-lg border border-[var(--outline)]">
              <div className="relative border-b border-[var(--outline)] p-1.5">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  autoFocus
                  className="h-8 w-full rounded-md bg-[var(--surface-2)] pl-8 pr-2 text-sm outline-none placeholder:text-[var(--text-dim)]"
                  placeholder="Rechercher une personne…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {wsDetail.isLoading && <div className="p-2 text-xs text-[var(--text-dim)]">Chargement…</div>}
                {(() => {
                  const avail = (wsDetail.data?.members ?? [])
                    .filter((m) => !memberIds.has(m.user.id))
                    .filter((m) => m.user.fullName.toLowerCase().includes(q.trim().toLowerCase()));
                  if (wsDetail.data && avail.length === 0)
                    return (
                      <div className="p-2 text-xs text-[var(--text-dim)]">
                        {q ? 'Aucun resultat' : "Tous les membres de l'espace sont deja la"}
                      </div>
                    );
                  return avail.map((m) => (
                    <button
                      key={m.user.id}
                      onClick={() => {
                        addMembers([m.user.id]);
                        setQ('');
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                    >
                      <span
                        className="grid h-6 w-6 place-items-center rounded-full text-2xs font-bold text-white"
                        style={{ background: tint(m.user.id) }}
                      >
                        {initials(m.user.fullName)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.user.fullName}</span>
                      <IconAdd className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          <ul className="space-y-0.5">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
                <button
                  onClick={() => openProfile(m.userId)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-bold text-white"
                    style={{ background: tint(m.userId) }}
                  >
                    {initials(m.user.fullName)}
                  </span>
                  <span className="truncate">{m.user.fullName}</span>
                </button>
                {!isDirect && members.length > 1 && (
                  <button
                    className="icon-btn-sm text-red-500"
                    title="Retirer"
                    onClick={() => removeMember(m.userId)}
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
