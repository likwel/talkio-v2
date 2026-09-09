import type { CSSProperties } from 'react';

/**
 * Fonds de conversation facon WhatsApp : une couleur unie + un leger semis de
 * points. Chaque preset a une variante claire et une variante sombre.
 */
export interface Wallpaper {
  id: string;
  label: string;
  light: string;
  lightDots: string;
  dark: string;
  darkDots: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'default', label: 'Defaut', light: '#efeae2', lightDots: 'rgba(0,0,0,0.04)', dark: '#0b141a', darkDots: 'rgba(255,255,255,0.022)' },
  { id: 'plain', label: 'Uni', light: '#f4f1ec', lightDots: 'transparent', dark: '#0d1418', darkDots: 'transparent' },
  { id: 'graphite', label: 'Graphite', light: '#e8e9ee', lightDots: 'rgba(0,0,0,0.05)', dark: '#14171c', darkDots: 'rgba(255,255,255,0.03)' },
  { id: 'sky', label: 'Ciel', light: '#e2ecf6', lightDots: 'rgba(30,64,110,0.07)', dark: '#0b1622', darkDots: 'rgba(120,170,230,0.05)' },
  { id: 'sand', label: 'Sable', light: '#f2e8d4', lightDots: 'rgba(120,90,30,0.07)', dark: '#1a160f', darkDots: 'rgba(220,190,120,0.05)' },
  { id: 'forest', label: 'Foret', light: '#e1ede0', lightDots: 'rgba(20,80,40,0.07)', dark: '#0c150f', darkDots: 'rgba(120,200,150,0.05)' },
  { id: 'rose', label: 'Rose', light: '#f7e4ea', lightDots: 'rgba(160,30,70,0.07)', dark: '#1a0f13', darkDots: 'rgba(255,120,160,0.05)' },
  { id: 'lavender', label: 'Lavande', light: '#ece7f6', lightDots: 'rgba(90,60,160,0.07)', dark: '#130f1c', darkDots: 'rgba(180,150,240,0.05)' },
];

export function getWallpaper(id: string | null | undefined): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

/** Style inline a poser sur le conteneur des messages. */
export function wallpaperStyle(
  id: string | null | undefined,
  theme: 'light' | 'dark',
): CSSProperties {
  const w = getWallpaper(id);
  const bg = theme === 'dark' ? w.dark : w.light;
  const dots = theme === 'dark' ? w.darkDots : w.lightDots;
  return {
    backgroundColor: bg,
    backgroundImage: `radial-gradient(${dots} 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
  };
}

/** Apercu compact (swatch) pour les selecteurs. */
export function wallpaperSwatch(w: Wallpaper, theme: 'light' | 'dark'): CSSProperties {
  return { backgroundColor: theme === 'dark' ? w.dark : w.light };
}
