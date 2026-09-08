import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Channel, UserProfile } from '@/lib/types';
import { IconPersonAdd, IconChat, IconTick, IconClose } from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export default function ProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [p, setP] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!userId) return;
    setP((await api.get<UserProfile>(`/users/${userId}`)).data);
  }

  useEffect(() => {
    setP(null);
    load();
    const s = getSocket();
    const onCh = () => load();
    s.on('friend:changed', onCh);
    return () => {
      s.off('friend:changed', onCh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function friendAction() {
    if (!p) return;
    setBusy(true);
    try {
      if (p.friendState === 'none') await api.post('/friends/request', { email: p.email });
      else if (p.friendState === 'incoming' && p.friendshipId) await api.post(`/friends/${p.friendshipId}/accept`);
      else if (p.friendState === 'outgoing') await api.delete(`/friends/${p.id}`);
      else if (p.friendState === 'friends') await api.delete(`/friends/${p.id}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!p || !current) return;
    try {
      const r = await api.post<Channel>('/channels/direct', { workspaceId: current.id, userIds: [p.id] });
      onClose();
      navigate(`/chat/${r.data.id}`);
    } catch {
      /* pas dans cet espace */
    }
  }

  const label: Record<string, string> = {
    none: 'Ajouter en ami',
    outgoing: 'Annuler la demande',
    incoming: 'Accepter la demande',
    friends: 'Retirer des amis',
    self: '',
  };

  return (
    <Modal open={!!userId} onClose={onClose} size="sm" title="Profil">
      {!p ? (
        <div className="py-8 text-center text-sm text-[var(--text-dim)]">Chargement…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
              style={{ background: tint(p.id) }}
            >
              {initials(p.fullName)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold">{p.fullName}</div>
              <div className="truncate text-sm text-[var(--text-dim)]">{p.email}</div>
              <div className="text-xs text-[var(--text-dim)]">
                Membre depuis {new Date(p.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {p.sharedWorkspaces.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
                Espaces en commun
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.sharedWorkspaces.map((w) => (
                  <span key={w.id} className="chip" style={w.color ? { borderColor: w.color, color: w.color } : undefined}>
                    {w.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.friendState !== 'self' && (
            <div className="flex gap-2 pt-1">
              <button className="btn-primary flex-1" onClick={message}>
                <IconChat className="h-4 w-4" /> Message
              </button>
              <button
                className={p.friendState === 'friends' ? 'btn-outlined' : 'btn-tonal'}
                onClick={friendAction}
                disabled={busy}
              >
                {p.friendState === 'friends' ? (
                  <IconClose className="h-4 w-4" />
                ) : p.friendState === 'incoming' ? (
                  <IconTick className="h-4 w-4" />
                ) : (
                  <IconPersonAdd className="h-4 w-4" />
                )}
                {label[p.friendState]}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
