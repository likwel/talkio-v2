import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

interface ThemeState {
  /** Choix de l'utilisateur. */
  pref: ThemePref;
  /** Theme reellement applique. */
  theme: Resolved;
  setPref: (t: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function initialPref(): ThemePref {
  const saved = localStorage.getItem('talkio.theme');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  const [resolved, setResolved] = useState<Resolved>(() =>
    initialPref() === 'system' ? (systemDark() ? 'dark' : 'light') : (initialPref() as Resolved),
  );

  useEffect(() => {
    const apply = () => {
      const next: Resolved = pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref;
      setResolved(next);
      const root = document.documentElement;
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
    };
    apply();
    localStorage.setItem('talkio.theme', pref);

    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  const value: ThemeState = {
    pref,
    theme: resolved,
    setPref: setPrefState,
    toggle: () => setPrefState(resolved === 'dark' ? 'light' : 'dark'),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme hors ThemeProvider');
  return ctx;
}
