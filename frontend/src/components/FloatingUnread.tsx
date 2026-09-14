import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import type { Channel } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { IconHash, IconGroups } from '@/lib/icons';

const MAX_HEADS = 4;

interface Head {
  id: string;
  name: string;
  unread: number;
  avatarId: string;
  avatarName?: string | null;
  avatarSrc?: string | null;
  salon?: boolean;
  group?: boolean;
  color?: string | null;
}

/**
 * Bulles de conversation facon Messenger (bas-droite) : une pastille par
 * conversation non lue — avatar + compteur rouge en haut, nom au survol,
 * clic = ouverture directe de la conversation.
 */
export default function FloatingUnread() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [bump, setBump] = useState(false);
  const prev = useRef(0);

  const channels = useQuery({
    queryKey: ['channels', current?.id],
    enabled: !!current,
    refetchInterval: 20_000,
    queryFn: async () =>
      (await api.get<Channel[]>('/channels', { params: { workspaceId: current!.id } })).data,
  });

  const heads = useMemo<Head[]>(() => {
    const meId = user?.id;
    return (channels.data ?? [])
      .filter((c) => (c.unreadCount ?? 0) > 0)
      .map((c): Head => {
        if (c.type === 'DIRECT') {
          const others = (c.members ?? []).filter((m) => m.userId !== meId);
          if (others.length === 1) {
            const u = others[0].user;
            return {
              id: c.id,
              name: u.fullName,
              unread: c.unreadCount ?? 0,
              avatarId: u.id,
              avatarName: u.fullName,
              avatarSrc: u.avatarUrl,
            };
          }
          const name =
            c.name || others.map((m) => m.user.fullName.split(' ')[0]).join(', ') || 'Groupe';
          return { id: c.id, name, unread: c.unreadCount ?? 0, avatarId: c.id, group: true };
        }
        return {
          id: c.id,
          name: c.name ?? 'salon',
          unread: c.unreadCount ?? 0,
          avatarId: c.id,
          salon: true,
          color: c.color,
        };
      })
      .sort((a, b) => b.unread - a.unread);
  }, [channels.data, user?.id]);

  const totalUnread = heads.reduce((n, h) => n + h.unread, 0);

  useEffect(() => {
    const grew = totalUnread > prev.current;
    prev.current = totalUnread;
    if (!grew) return;
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 900);
    return () => window.clearTimeout(t);
  }, [totalUnread]);

  // Deja dans la messagerie : la liste montre deja les compteurs.
  if (pathname === '/' || pathname.startsWith('/chat')) return null;
  if (heads.length === 0) return null;

  const shown = heads.slice(0, MAX_HEADS);
  const hidden = heads.slice(MAX_HEADS);
  const hiddenCount = hidden.reduce((n, h) => n + h.unread, 0);

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2.5 lg:bottom-5 lg:right-5">
      {shown.map((h, i) => (
        <ChatHead
          key={h.id}
          head={h}
          bump={bump && i === 0}
          onClick={() => navigate(`/chat/${h.id}`)}
        />
      ))}

      {hidden.length > 0 && (
        <button
          onClick={() => navigate('/')}
          title={`${hidden.length} autre(s) conversation(s)`}
          className="group relative grid h-12 w-12 place-items-center rounded-full border border-[var(--outline)] bg-[var(--surface)] text-sm font-bold text-[var(--text-dim)] shadow-elevation-3 transition hover:-translate-y-0.5 hover:text-[var(--text)]"
        >
          +{hidden.length}
          {hiddenCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-[var(--bg)] bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {hiddenCount > 99 ? '99+' : hiddenCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function ChatHead({ head, bump, onClick }: { head: Head; bump: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative block h-12 w-12 rounded-full shadow-elevation-3 transition-transform',
        bump ? 'scale-105' : 'hover:-translate-y-0.5',
      )}
      aria-label={head.name}
    >
      {/* Nom au survol */}
      <span className="pointer-events-none absolute right-full top-1/2 mr-2.5 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--text)] px-2.5 py-1 text-xs font-semibold text-[var(--bg)] opacity-0 shadow-elevation-2 transition-opacity group-hover:opacity-100">
        {head.name}
      </span>

      {/* Pastille : avatar (DM) ou glyphe (salon / groupe) */}
      {head.salon ? (
        <span
          className="grid h-12 w-12 place-items-center rounded-full text-white"
          style={{ background: head.color || 'var(--accent)' }}
        >
          <IconHash className="h-5 w-5" />
        </span>
      ) : head.group ? (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
          <IconGroups className="h-6 w-6" />
        </span>
      ) : (
        <Avatar id={head.avatarId} name={head.avatarName} src={head.avatarSrc} size={48} />
      )}

      {/* Compteur rouge en haut */}
      <span
        className={clsx(
          'absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-[var(--bg)] bg-red-500 px-1 text-[10px] font-bold leading-none text-white',
          bump && 'animate-pulse',
        )}
      >
        {head.unread > 99 ? '99+' : head.unread}
      </span>
    </button>
  );
}
