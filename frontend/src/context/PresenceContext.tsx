import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getSocket } from '@/lib/socket';
import type { PresenceStatus } from '@/lib/types';

export type PresenceDotState = 'online' | 'away' | 'busy' | 'offline';

interface PresenceApi {
  /** Etat affichable pour un utilisateur (tient compte du mode Invisible). */
  presenceOf: (userId: string, fallbackStatus?: PresenceStatus | null) => PresenceDotState;
}

const Ctx = createContext<PresenceApi | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<Set<string>>(() => new Set());
  const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    const socket = getSocket();
    const onSnapshot = (ids: string[]) => setOnline(new Set(ids));
    const onChange = (p: { userId: string; online?: boolean; status?: PresenceStatus }) => {
      if (typeof p.online === 'boolean') {
        setOnline((prev) => {
          const next = new Set(prev);
          if (p.online) next.add(p.userId);
          else next.delete(p.userId);
          return next;
        });
      }
      if (p.status) setStatuses((prev) => ({ ...prev, [p.userId]: p.status! }));
    };
    socket.on('presence:snapshot', onSnapshot);
    socket.on('presence:changed', onChange);
    return () => {
      socket.off('presence:snapshot', onSnapshot);
      socket.off('presence:changed', onChange);
    };
  }, []);

  const presenceOf = useCallback<PresenceApi['presenceOf']>(
    (userId, fallbackStatus) => {
      const manual = statuses[userId] ?? fallbackStatus ?? 'ONLINE';
      if (manual === 'INVISIBLE') return 'offline';
      if (!online.has(userId)) return 'offline';
      if (manual === 'AWAY') return 'away';
      if (manual === 'BUSY') return 'busy';
      return 'online';
    },
    [online, statuses],
  );

  const value = useMemo(() => ({ presenceOf }), [presenceOf]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePresence() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePresence hors PresenceProvider');
  return ctx;
}

// --- Libelles / styles partages -------------------------------------------

export const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; dot: PresenceDotState }[] = [
  { value: 'ONLINE', label: 'En ligne', dot: 'online' },
  { value: 'AWAY', label: 'Absent', dot: 'away' },
  { value: 'BUSY', label: 'Ne pas deranger', dot: 'busy' },
  { value: 'INVISIBLE', label: 'Invisible', dot: 'offline' },
];

export const DOT_COLOR: Record<PresenceDotState, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  busy: '#ef4444',
  offline: '#94a3b8',
};

export const DOT_LABEL: Record<PresenceDotState, string> = {
  online: 'En ligne',
  away: 'Absent',
  busy: 'Ne pas deranger',
  offline: 'Hors ligne',
};
