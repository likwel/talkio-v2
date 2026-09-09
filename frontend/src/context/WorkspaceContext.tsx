import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

interface WorkspaceState {
  workspaces: Workspace[];
  /** Ordonnes par utilisation recente (le courant en tete). */
  orderedWorkspaces: Workspace[];
  /** Espaces reels (hors espace personnel) — proposes dans le selecteur de messagerie. */
  teamWorkspaces: Workspace[];
  current: Workspace | null;
  /** Espace personnel : depot par defaut des Projets / MEAL / Collecte. */
  personal: Workspace | null;
  setCurrent: (w: Workspace) => void;
  reload: () => Promise<void>;
  /** Rafraichit la liste (compteurs de non lus) sans changer l'espace courant. */
  refreshList: () => Promise<void>;
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
  const { setAccentOverride } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [current, setCurrentState] = useState<Workspace | null>(null);
  const [recentTick, setRecentTick] = useState(0);

  // La couleur de l'espace actif devient l'accent global de l'app.
  useEffect(() => {
    setAccentOverride(current?.color ?? null);
  }, [current?.id, current?.color, setAccentOverride]);

  async function reload() {
    const r = await api.get<Workspace[]>('/workspaces');
    setWorkspaces(r.data);
    const savedId = localStorage.getItem('talkio.workspace');
    // Messagerie : on privilegie un espace d'equipe ; l'espace personnel n'est qu'un repli.
    const next =
      r.data.find((w) => w.id === savedId) ||
      r.data.find((w) => !w.isPersonal) ||
      r.data[0] ||
      null;
    setCurrentState(next);
    if (next) pushRecent(next.id);
  }

  // Rafraichit la liste (compteurs de non lus) sans changer l'espace courant.
  async function refreshList() {
    try {
      const r = await api.get<Workspace[]>('/workspaces');
      setWorkspaces(r.data);
      setCurrentState((cur) => (cur ? r.data.find((w) => w.id === cur.id) ?? cur : cur));
    } catch {
      /* silencieux */
    }
  }

  useEffect(() => {
    if (user) reload();
    else {
      setWorkspaces([]);
      setCurrentState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(refreshList, 20_000);
    const onFocus = () => refreshList();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function setCurrent(w: Workspace) {
    setCurrentState(w);
    localStorage.setItem('talkio.workspace', w.id);
    pushRecent(w.id);
    setRecentTick((t) => t + 1);
  }

  const personal = useMemo(
    () => workspaces.find((w) => w.isPersonal) ?? workspaces[0] ?? null,
    [workspaces],
  );
  const teamWorkspaces = useMemo(() => workspaces.filter((w) => !w.isPersonal), [workspaces]);

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
    <Ctx.Provider
      value={{
        workspaces,
        orderedWorkspaces,
        teamWorkspaces,
        current,
        personal,
        setCurrent,
        reload,
        refreshList,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace hors provider');
  return ctx;
}
