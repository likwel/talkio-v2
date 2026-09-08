import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import SettingsModal, { type SettingsTab } from '@/components/SettingsModal';

interface SettingsApi {
  /** Ouvre la fenetre Parametres (onglet « Profil » par defaut). */
  openSettings: (tab?: SettingsTab) => void;
}

const Ctx = createContext<SettingsApi | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; tab: SettingsTab }>({ open: false, tab: 'profil' });
  const openSettings = useCallback((tab: SettingsTab = 'profil') => setState({ open: true, tab }), []);

  return (
    <Ctx.Provider value={{ openSettings }}>
      {children}
      <SettingsModal
        open={state.open}
        initialTab={state.tab}
        onClose={() => setState((s) => ({ ...s, open: false }))}
      />
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings hors SettingsProvider');
  return ctx;
}
