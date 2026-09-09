import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/Avatar';
import type { Channel, WorkspaceDetail } from '@/lib/types';

/**
 * Panneau « Membres » : tous les membres de l'espace sont dans le salon.
 * On peut ici activer / désactiver l'accès de chacun (les permissions fines
 * — lecture / écriture — se règlent dans les paramètres du salon).
 */
export default function ChannelMembersModal({
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
  const { user } = useAuth();
  const isDirect = channel?.type === 'DIRECT';

  const detail = useQuery({
    queryKey: ['channel', channel?.id],
    enabled: open && !!channel,
    queryFn: async () => (await api.get<Channel>(`/channels/${channel!.id}`)).data,
  });
  const wsDetail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && !isDirect && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });

  const rows = detail.data?.members ?? channel?.members ?? [];
  const permByUser = useMemo(() => {
    const m = new Map<string, { canView: boolean; canWrite: boolean }>();
    for (const r of rows) m.set(r.userId, { canView: r.canView !== false, canWrite: r.canWrite !== false });
    return m;
  }, [rows]);

  async function toggleActive(userId: string, active: boolean) {
    if (!channel) return;
    await api.patch(`/channels/${channel.id}/members/${userId}/permissions`, {
      canView: active,
      ...(active ? { canRead: true, canWrite: true } : { canRead: false, canWrite: false }),
    });
    detail.refetch();
    onChanged();
  }

  // Conversations directes : simple liste des participants.
  const people: { id: string; fullName: string; avatarUrl?: string | null }[] = isDirect
    ? rows.map((r) => ({ id: r.userId, fullName: r.user.fullName, avatarUrl: r.user.avatarUrl }))
    : (wsDetail.data?.members ?? []).map((m) => ({
        id: m.user.id,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
      }));

  return (
    <Modal open={open} onClose={onClose} title={isDirect ? 'Participants' : 'Membres du salon'}>
      <div className="space-y-2">
        {!isDirect && (
          <p className="text-xs text-[var(--text-dim)]">
            Tous les membres de l'espace ont accès à ce salon. Désactivez quelqu'un pour qu'il ne
            le voie plus. Les permissions détaillées sont dans les paramètres du salon.
          </p>
        )}
        {wsDetail.isLoading && !isDirect && (
          <div className="py-3 text-xs text-[var(--text-dim)]">Chargement…</div>
        )}
        <ul className="max-h-96 space-y-0.5 overflow-y-auto">
          {people.map((p) => {
            const perm = permByUser.get(p.id) ?? { canView: true, canWrite: true };
            const self = p.id === user?.id;
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm">
                <button
                  onClick={() => openProfile(p.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Avatar id={p.id} name={p.fullName} src={p.avatarUrl} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate">
                      {p.fullName}
                      {self && <span className="text-[var(--text-dim)]"> (vous)</span>}
                    </span>
                    {!isDirect && (
                      <span className="block text-2xs text-[var(--text-dim)]">
                        {!perm.canView ? 'Désactivé' : perm.canWrite ? 'Lecture + écriture' : 'Lecture seule'}
                      </span>
                    )}
                  </span>
                </button>
                {!isDirect && !self && (
                  <button
                    onClick={() => toggleActive(p.id, !perm.canView)}
                    className={clsx(
                      'relative h-5 w-9 shrink-0 rounded-full transition',
                      perm.canView ? 'bg-[var(--accent)]' : 'bg-[var(--outline)]',
                    )}
                    title={perm.canView ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                        perm.canView ? 'left-4' : 'left-0.5',
                      )}
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
