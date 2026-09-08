import { create } from 'zustand';

/** Compteur de chargements de route (chunks lazy) pour la barre de progression. */
export const useRouteLoading = create<{
  pending: number;
  begin: () => void;
  end: () => void;
}>((set) => ({
  pending: 0,
  begin: () => set((s) => ({ pending: s.pending + 1 })),
  end: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),
}));
