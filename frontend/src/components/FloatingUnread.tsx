import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Channel } from '@/lib/types';
import { IconChat, IconHash, IconAt } from '@/lib/icons';

/** Bulle flottante (bas-droite) : messages non lus en temps reel, separes salons / perso. */
export default function FloatingUnread() {
  const { current } = useWorkspace();
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

  const list = channels.data ?? [];
  const salons = list.filter((c) => c.type !== 'DIRECT').reduce((n, c) => n + (c.unreadCount ?? 0), 0);
  const dms = list.filter((c) => c.type === 'DIRECT').reduce((n, c) => n + (c.unreadCount ?? 0), 0);
  const totalUnread = salons + dms;

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
  if (totalUnread === 0) return null;

  return (
    <button
      onClick={() => navigate('/')}
      title={`${totalUnread} message(s) non lu(s)`}
      className={clsx(
        'fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-[var(--outline)] bg-[var(--surface)] py-1.5 pl-2 pr-2.5 shadow-elevation-3 transition-transform lg:bottom-5 lg:right-5',
        bump ? 'scale-105' : 'hover:-translate-y-0.5',
      )}
    >
      <span
        className={clsx(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white',
          bump && 'animate-pulse',
        )}
      >
        <IconChat className="h-4 w-4" />
      </span>
      {salons > 0 && (
        <span
          className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-sm font-bold text-white"
          title={`${salons} dans les salons`}
        >
          <IconHash className="h-3.5 w-3.5" />
          {salons > 99 ? '99+' : salons}
        </span>
      )}
      {dms > 0 && (
        <span
          className="flex items-center gap-1 rounded-full bg-[#8774e1] px-2 py-0.5 text-sm font-bold text-white"
          title={`${dms} en messages directs`}
        >
          <IconAt className="h-3.5 w-3.5" />
          {dms > 99 ? '99+' : dms}
        </span>
      )}
    </button>
  );
}
