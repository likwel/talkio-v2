import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

export const DEFAULT_ACCENT = '#ff2c5f';
export const ACCENT_PRESETS = [
  '#ff2c5f', // rose Talkio (defaut)
  '#3390ec', // bleu
  '#8774e1', // violet
  '#0891b2', // cyan
  '#059669', // emeraude
  '#0cae36', // vert Talkio (historique)
  '#65a30d', // olive
  '#ea580c', // orange
  '#db2777', // rose fonce
  '#e11d48', // rouge
];

interface ThemeState {
  pref: ThemePref;
  theme: Resolved;
  setPref: (t: ThemePref) => void;
  toggle: () => void;
  /** Couleur d'accent choisie par l'utilisateur. */
  accent: string;
  setAccent: (hex: string) => void;
  /** Surcharge transitoire (ex : couleur de l'espace actif). null pour retirer. */
  setAccentOverride: (hex: string | null) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function initialPref(): ThemePref {
  const s = localStorage.getItem('talkio.theme');
  return s === 'light' || s === 'dark' || s === 'system' ? s : 'system';
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 44, 95];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function applyAccent(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const root = document.documentElement.style;
  root.setProperty('--accent', `rgb(${r} ${g} ${b})`);
  root.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.13)`);
  root.setProperty('--accent-softer', `rgba(${r}, ${g}, ${b}, 0.08)`);
  root.setProperty('--accent-strong', `rgb(${Math.round(r * 0.8)} ${Math.round(g * 0.8)} ${Math.round(b * 0.8)})`);
  root.setProperty('--accent-ring', `rgba(${r}, ${g}, ${b}, 0.22)`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  const [resolved, setResolved] = useState<Resolved>(() =>
    initialPref() === 'system' ? (systemDark() ? 'dark' : 'light') : (initialPref() as Resolved),
  );
  const [accent, setAccentState] = useState<string>(() => localStorage.getItem('talkio.accent') || DEFAULT_ACCENT);
  const [override, setOverride] = useState<string | null>(null);

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

  useEffect(() => {
    applyAccent(override || accent || DEFAULT_ACCENT);
  }, [accent, override]);

  const value: ThemeState = {
    pref,
    theme: resolved,
    setPref: setPrefState,
    toggle: () => setPrefState(resolved === 'dark' ? 'light' : 'dark'),
    accent,
    setAccent: (hex) => {
      setAccentState(hex);
      localStorage.setItem('talkio.accent', hex);
    },
    setAccentOverride: setOverride,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme hors ThemeProvider');
  return ctx;
}
