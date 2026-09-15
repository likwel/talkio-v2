import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useAutoAway } from '@/hooks/useAutoAway';
import BottomNav from '@/components/BottomNav';
import Wordmark from '@/components/Wordmark';
import IncomingCallModal from '@/components/IncomingCallModal';
import FloatingUnread from '@/components/FloatingUnread';
import NotificationBell from '@/components/NotificationBell';
import AccountMenu from '@/components/AccountMenu';
import MessageNotifier from '@/components/MessageNotifier';
import { RouteFallback } from '@/components/TopProgress';
import { NAV_ITEMS } from '@/lib/nav';
import { useT } from '@/i18n';
import { IconDehaze, IconMenuOpen } from '@/lib/icons';

export default function Layout() {
  const t = useT();
  useAutoAway();
  const isDesktop = useIsDesktop();
  const location = useLocation();

  const [expanded, setExpanded] = useState(() => localStorage.getItem('talkio.rail') === 'open');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('talkio.rail', expanded ? 'open' : 'closed');
  }, [expanded]);

  // Ferme le tiroir mobile a chaque navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Sur mobile le rail est un tiroir : toujours "deploye" visuellement
  const showLabels = !isDesktop || expanded;
  const currentSectionKey = NAV_ITEMS.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
  )?.labelKey;
  const currentSection = currentSectionKey ? t(currentSectionKey) : undefined;

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* ---------- Barre superieure (mobile / tablette) ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--outline)] bg-[var(--rail)] px-2 lg:hidden">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
          <IconDehaze className="icon-3d h-6 w-6" />
        </button>
        {currentSection ? (
          <span className="font-display text-base font-bold tracking-tight">{currentSection}</span>
        ) : (
          <Wordmark size="sm" />
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <NotificationBell panelSide="down" />
          <AccountMenu align="right" />
        </div>
      </header>

      {/* ---------- Fond sombre du tiroir mobile ---------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ---------- Rail ---------- */}
      <aside
        className={clsx(
          'z-50 flex shrink-0 flex-col border-r border-[var(--outline)] bg-[var(--rail)] transition-transform duration-200',
          'fixed inset-y-0 left-0 w-[236px] lg:relative lg:z-50 lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          expanded ? 'lg:w-[236px]' : 'lg:w-[72px]',
        )}
      >
        {/* Marque / repli */}
        {showLabels ? (
          <div className="flex h-14 items-center gap-2 px-4">
            <Wordmark size="md" />
            <button
              className="icon-btn ml-auto"
              onClick={() => (isDesktop ? setExpanded(false) : setMobileOpen(false))}
              aria-label={isDesktop ? 'Reduire' : 'Fermer'}
            >
              <IconMenuOpen className="icon-3d h-6 w-6" />
            </button>
          </div>
        ) : (
          <div className="flex h-14 items-center justify-center">
            <button
              onClick={() => setExpanded(true)}
              aria-label="Déployer le menu"
              title="Déployer le menu"
              className="grid h-9 w-9 place-items-center rounded-xl text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              <IconDehaze className="icon-3d h-6 w-6" />
            </button>
          </div>
        )}

        {/* Navigation - defile si la hauteur est serree.
            Sur mobile / tablette elle vit aussi dans la barre d'onglets du bas (BottomNav). */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {NAV_ITEMS.map(({ to, labelKey, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={t(labelKey)}
              className={({ isActive }) =>
                clsx(
                  'relative flex h-10 items-center gap-3 rounded-lg text-base font-medium transition',
                  showLabels ? 'px-3' : 'justify-center',
                  isActive
                    ? 'accent-active'
                    : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                  )}
                  <Icon className={clsx('h-[22px] w-[22px] shrink-0', isActive ? 'icon-3d-strong' : 'icon-3d')} />
                  {showLabels && t(labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-auto">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <BottomNav />
      <IncomingCallModal />

      {/* Bulles de conversation facon Messenger (bas-droite) */}
      <FloatingUnread />
      <MessageNotifier />
    </div>
  );
}
