import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import type { AppNotification } from '@/lib/types';

interface Feed {
  items: AppNotification[];
  unread: number;
  nextBefore: string | null;
}

interface NotificationsState {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  reload: () => void;
}

const Ctx = createContext<NotificationsState | undefined>(undefined);
const KEY = ['notifications'] as const;

function ding() {
  try {
    if (localStorage.getItem('talkio.mute') === '1') return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    o.start();
    o.stop(ctx.currentTime + 0.34);
    o.onended = () => ctx.close();
  } catch {
    /* audio indisponible */
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => (await api.get<Feed>('/notifications')).data,
  });

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onNew = (n: AppNotification) => {
      qc.setQueryData<Feed>(KEY, (old) => {
        const items = old?.items ?? [];
        if (items.some((x) => x.id === n.id)) return old as Feed;
        return {
          items: [n, ...items].slice(0, 50),
          unread: (old?.unread ?? 0) + 1,
          nextBefore: old?.nextBefore ?? null,
        };
      });
      ding();
    };
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [user, qc]);

  const patchUnread = useCallback(
    (unread: number) => qc.setQueryData<Feed>(KEY, (old) => (old ? { ...old, unread } : old)),
    [qc],
  );

  const markRead = useCallback(
    async (id: string) => {
      qc.setQueryData<Feed>(KEY, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((x) => (x.id === id && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)),
              unread: Math.max(0, old.unread - (old.items.find((x) => x.id === id && !x.readAt) ? 1 : 0)),
            }
          : old,
      );
      const r = await api.post<{ unread: number }>('/notifications/read', { id });
      patchUnread(r.data.unread);
    },
    [qc, patchUnread],
  );

  const markAllRead = useCallback(async () => {
    qc.setQueryData<Feed>(KEY, (old) =>
      old ? { ...old, items: old.items.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })), unread: 0 } : old,
    );
    await api.post('/notifications/read', { all: true });
  }, [qc]);

  const remove = useCallback(
    async (id: string) => {
      qc.setQueryData<Feed>(KEY, (old) =>
        old
          ? {
              ...old,
              items: old.items.filter((x) => x.id !== id),
              unread: Math.max(0, old.unread - (old.items.find((x) => x.id === id && !x.readAt) ? 1 : 0)),
            }
          : old,
      );
      await api.delete(`/notifications/${id}`);
    },
    [qc],
  );

  const clearAll = useCallback(async () => {
    qc.setQueryData<Feed>(KEY, { items: [], unread: 0, nextBefore: null });
    await api.delete('/notifications');
  }, [qc]);

  const value = useMemo<NotificationsState>(
    () => ({
      items: query.data?.items ?? [],
      unread: query.data?.unread ?? 0,
      loading: query.isLoading,
      markRead,
      markAllRead,
      remove,
      clearAll,
      reload: () => query.refetch(),
    }),
    [query.data, query.isLoading, query.refetch, markRead, markAllRead, remove, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications doit etre utilise dans NotificationsProvider');
  return ctx;
}
