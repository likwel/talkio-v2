import type { ComponentType } from 'react';
import { IconChat, IconCalendar, IconKanban, IconAnalytics, IconForms } from '@/lib/icons';

export type NavIcon = ComponentType<{ className?: string }>;

/** Sections principales - partagees par le rail (desktop) et la barre d'onglets (mobile). */
export const NAV_ITEMS: { to: string; label: string; end?: boolean; Icon: NavIcon }[] = [
  { to: '/', label: 'Messagerie', end: true, Icon: IconChat },
  { to: '/projects', label: 'Projet', Icon: IconKanban },
  { to: '/calendar', label: 'Agenda', Icon: IconCalendar },
  { to: '/meal', label: 'MEAL', Icon: IconAnalytics },
  { to: '/forms', label: 'Collecte', Icon: IconForms },
];
