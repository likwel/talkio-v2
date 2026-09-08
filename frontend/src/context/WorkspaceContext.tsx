import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { useAuth } from './AuthContext';

interface WorkspaceState {
  workspaces: Workspace[];
  /** Ordonnes par utilisation recente (le courant en tete). */
  orderedWorkspaces: Workspace[];
  current: Workspace | null;
  setCurrent: (w: Workspace) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<WorkspaceState | undefined>(undefined);
const RECENT_KEY = 'talkio.wsRecent';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 30);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrentState] = useState<Workspace | null>(null);
  const [recentTick, setRecentTick] = useState(0);

  async function reload() {
    const r = await api.get<Workspace[]>('/workspaces');
    setWorkspaces(r.data);
    const savedId = localStorage.getItem('talkio.workspace');
    const next = r.data.find((w) => w.id === savedId) || r.data[0] || null;
    setCurrentState(next);
    if (next) pushRecent(next.id);
  }

  useEffect(() => {
    if (user) reload();
    else {
      setWorkspaces([]);
      setCurrentState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function setCurrent(w: Workspace) {
    setCurrentState(w);
    localStorage.setItem('talkio.workspace', w.id);
    pushRecent(w.id);
    setRecentTick((t) => t + 1);
  }

  const orderedWorkspaces = useMemo(() => {
    const recent = readRecent();
    const rank = (id: string) => {
      const i = recent.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...workspaces].sort((a, b) => {
      if (a.id === current?.id) return -1;
      if (b.id === current?.id) return 1;
      return rank(a.id) - rank(b.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, current, recentTick]);

  return (
    <Ctx.Provider value={{ workspaces, orderedWorkspaces, current, setCurrent, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace hors provider');
  return ctx;
}
