import type { ComponentType } from 'react';
import { IconChat, IconCalendar, IconKanban, IconAnalytics } from '@/lib/icons';

export type NavIcon = ComponentType<{ className?: string }>;

/** Sections principales - partagees par le rail (desktop) et la barre d'onglets (mobile).
 *  `labelKey` est une cle de traduction (voir src/i18n/translations.ts).
 *  MEAL et Collecte sont regroupes sous une seule entree (`/meal`, onglets internes). */
export const NAV_ITEMS: { to: string; labelKey: string; end?: boolean; Icon: NavIcon }[] = [
  { to: '/', labelKey: 'nav.messaging', end: true, Icon: IconChat },
  { to: '/projects', labelKey: 'nav.projects', Icon: IconKanban },
  { to: '/calendar', labelKey: 'nav.calendar', Icon: IconCalendar },
  { to: '/meal', labelKey: 'nav.meal', Icon: IconAnalytics },
];
