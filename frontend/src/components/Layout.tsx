import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ComponentType } from 'react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { api } from '@/lib/api';
import SettingsModal from '@/components/SettingsModal';
import WorkspacesModal from '@/components/WorkspacesModal';
import {
  IconChat,
  IconCalendar,
  IconKanban,
  IconAnalytics,
  IconForms,
  IconLogout,
  IconMenu,
  IconAdd,
  IconSettings,
} from '@/lib/icons';

type IconType = ComponentType<{ className?: string }>;

const nav: { to: string; label: string; end?: boolean; Icon: IconType }[] = [
  { to: '/', label: 'Messagerie', end: true, Icon: IconChat },
  { to: '/projects', label: 'Projet', Icon: IconKanban },
  { to: '/calendar', label: 'Agenda', Icon: IconCalendar },
  { to: '/meal', label: 'MEAL', Icon: IconAnalytics },
  { to: '/forms', label: 'Collecte', Icon: IconForms },
];

const AV_COLORS = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
function tint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
function initials(name?: string) {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { orderedWorkspaces, current, setCurrent, reload } = useWorkspace();
  const dialog = useDialog();
  const isDesktop = useIsDesktop();
  const location = useLocation();

  const [expanded, setExpanded] = useState(() => localStorage.getItem('talkio.rail') === 'open');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem('talkio.rail', expanded ? 'open' : 'closed');
  }, [expanded]);

  // Ferme le tiroir mobile a chaque navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenu) return;
    const close = (e: MouseEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setUserMenu(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [userMenu]);

  async function createWorkspace() {
    const name = await dialog.prompt({
      title: 'Nouvel espace de travail',
      label: 'Nom',
      placeholder: 'Mon equipe',
      confirmLabel: 'Creer',
    });
    if (!name?.trim()) return;
    await api.post('/workspaces', { name: name.trim() });
    await reload();
  }

  const topWorkspaces = orderedWorkspaces.slice(0, 3);
  const moreCount = Math.max(0, orderedWorkspaces.length - 3);

  // Sur mobile le rail est un tiroir : toujours "deploye" visuellement
  const showLabels = !isDesktop || expanded;
  const currentSection = nav.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label;

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* ---------- Barre superieure (mobile / tablette) ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--outline)] bg-[var(--rail)] px-2 lg:hidden">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
          <IconMenu className="h-6 w-6" />
        </button>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
          T
        </span>
        <span className="font-display text-base font-bold">{currentSection ?? 'Talkio'}</span>
      </header>

      {/* ---------- Fond sombre du tiroir mobile ---------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ---------- Rail ---------- */}
      <aside
        ref={railRef}
        className={clsx(
          'z-40 flex shrink-0 flex-col border-r border-[var(--outline)] bg-[var(--rail)] transition-transform duration-200',
          'fixed inset-y-0 left-0 w-[236px] lg:static lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          expanded ? 'lg:w-[236px]' : 'lg:w-[72px]',
        )}
      >
        {/* Marque / repli (desktop) */}
        {showLabels ? (
          <div className="flex h-14 items-center gap-2 px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-base font-bold text-white">
              T
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Talkio</span>
            <button
              className="icon-btn ml-auto"
              onClick={() => (isDesktop ? setExpanded(false) : setMobileOpen(false))}
              aria-label={isDesktop ? 'Reduire' : 'Fermer'}
            >
              <IconMenu className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex h-14 items-center justify-center">
            <button
              onClick={() => setExpanded(true)}
              aria-label="Deployer"
              title="Deployer le menu"
              className="group grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-base font-bold text-white transition hover:brightness-110"
            >
              <span className="group-hover:hidden">T</span>
              <IconMenu className="hidden h-5 w-5 group-hover:block" />
            </button>
          </div>
        )}

        {/* Espaces de travail ("serveurs") */}
        <div className="shrink-0 space-y-1 px-3 pb-2">
          {showLabels && (
            <div className="px-1 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Espaces
            </div>
          )}
          {topWorkspaces.map((w) => {
            const active = w.id === current?.id;
            return (
              <button
                key={w.id}
                onClick={() => setCurrent(w)}
                title={w.name}
                className={clsx(
                  'group relative flex w-full items-center gap-2 rounded-lg transition',
                  showLabels ? 'px-1.5 py-1' : 'justify-center py-0.5',
                  active ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5',
                )}
              >
                {active && (
                  <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                )}
                <span
                  className={clsx(
                    'grid h-9 w-9 shrink-0 place-items-center text-xs font-bold text-white transition-all',
                    active ? 'rounded-xl' : 'rounded-2xl group-hover:rounded-xl',
                  )}
                  style={{ background: tint(w.id) }}
                >
                  {initials(w.name)}
                </span>
                {showLabels && (
                  <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">{w.name}</span>
                )}
              </button>
            );
          })}

          {moreCount > 0 && (
            <button
              onClick={() => setWsModalOpen(true)}
              title={`${moreCount} autre(s) espace(s)`}
              className={clsx(
                'flex items-center gap-2 rounded-lg text-[var(--text-dim)] transition hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                showLabels ? 'w-full px-1.5 py-1' : 'w-full justify-center py-0.5',
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] text-[11px] font-bold">
                +{moreCount}
              </span>
              {showLabels && <span className="text-[13px] font-medium">Voir plus ({moreCount})</span>}
            </button>
          )}

          <button
            onClick={createWorkspace}
            title="Nouvel espace"
            className={clsx(
              'flex items-center gap-2 rounded-lg text-[var(--text-dim)] transition hover:text-[var(--accent)]',
              showLabels ? 'w-full px-1.5 py-1' : 'w-full justify-center py-0.5',
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-dashed border-[var(--outline)] transition hover:rounded-xl hover:border-[var(--accent)]">
              <IconAdd className="h-5 w-5" />
            </span>
            {showLabels && <span className="text-[13px] font-medium">Nouvel espace</span>}
          </button>
        </div>

        <div className="mx-3 border-t border-[var(--outline)]" />

        {/* Navigation - defile si la hauteur est serree */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {nav.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                clsx(
                  'relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition',
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
                  <Icon className="h-[22px] w-[22px] shrink-0" />
                  {showLabels && label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bas : parametres + compte */}
        <div className="relative shrink-0 space-y-1 border-t border-[var(--outline)] p-3">
          <button
            onClick={() => setSettingsOpen(true)}
            title="Parametres"
            className={clsx(
              'flex h-10 items-center gap-3 rounded-lg text-sm font-medium text-[var(--text-dim)] transition hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
              showLabels ? 'w-full px-3' : 'w-full justify-center',
            )}
          >
            <IconSettings className="h-[22px] w-[22px]" />
            {showLabels && 'Parametres'}
          </button>

          <button
            onClick={() => setUserMenu((m) => !m)}
            className={clsx(
              'flex h-11 items-center gap-2 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5',
              showLabels ? 'w-full px-2' : 'w-full justify-center',
            )}
            title={user?.fullName}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
              {initials(user?.fullName)}
            </span>
            {showLabels && (
              <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">{user?.fullName}</span>
            )}
          </button>

          {userMenu && (
            <div className="absolute bottom-full left-3 right-3 z-30 mb-1 overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)] py-1 shadow-elevation-3">
              <div className="px-3 py-2">
                <div className="truncate text-sm font-semibold">{user?.fullName}</div>
                <div className="truncate text-xs text-[var(--text-dim)]">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  setUserMenu(false);
                  setSettingsOpen(true);
                }}
                className="flex w-full items-center gap-2 border-t border-[var(--outline)] px-3 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <IconSettings className="h-4 w-4" /> Parametres
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 border-t border-[var(--outline)] px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-500/10"
              >
                <IconLogout className="h-4 w-4" /> Se deconnecter
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WorkspacesModal open={wsModalOpen} onClose={() => setWsModalOpen(false)} />
    </div>
  );
}
