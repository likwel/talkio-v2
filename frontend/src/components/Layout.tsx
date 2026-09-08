import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { useProfile } from '@/context/ProfileContext';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { api } from '@/lib/api';
import WorkspacesModal from '@/components/WorkspacesModal';
import FriendsModal from '@/components/FriendsModal';
import AutomationsModal from '@/components/AutomationsModal';
import BottomNav from '@/components/BottomNav';
import Wordmark, { LogoBadge } from '@/components/Wordmark';
import IncomingCallModal from '@/components/IncomingCallModal';
import FloatingUnread from '@/components/FloatingUnread';
import MessageNotifier from '@/components/MessageNotifier';
import { RouteFallback } from '@/components/TopProgress';
import PresenceDot from '@/components/PresenceDot';
import StatusPicker from '@/components/StatusPicker';
import { type PresenceDotState, DOT_COLOR, DOT_LABEL } from '@/context/PresenceContext';
import { NAV_ITEMS } from '@/lib/nav';
import {
  IconLogout,
  IconMenu,
  IconAdd,
  IconSettings,
  IconPerson,
  IconChevronDown,
  IconFriends,
} from '@/lib/icons';

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
  const { openSettings } = useSettings();
  const { openProfile } = useProfile();
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(() => localStorage.getItem('talkio.rail') === 'open');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  async function messageFriend(userId: string) {
    if (!current) return;
    try {
      const r = await api.post('/channels/direct', { workspaceId: current.id, userIds: [userId] });
      navigate(`/chat/${r.data.id}`);
    } catch {
      /* la personne n'est peut-etre pas dans cet espace */
    }
  }
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
  const ownDot: PresenceDotState =
    user?.presenceStatus === 'INVISIBLE'
      ? 'offline'
      : user?.presenceStatus === 'AWAY'
        ? 'away'
        : user?.presenceStatus === 'BUSY'
          ? 'busy'
          : 'online';
  const currentSection = NAV_ITEMS.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
  )?.label;

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* ---------- Barre superieure (mobile / tablette) ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--outline)] bg-[var(--rail)] px-2 lg:hidden">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
          <IconMenu className="h-6 w-6" />
        </button>
        <LogoBadge size="sm" />
        {currentSection ? (
          <span className="font-display text-base font-bold tracking-tight">{currentSection}</span>
        ) : (
          <Wordmark size="sm" />
        )}
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
            <LogoBadge size="md" />
            <Wordmark size="md" />
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
              className="group grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#8774e1] font-display text-base font-black text-white shadow-[0_2px_10px_var(--accent-ring)] transition hover:brightness-110"
            >
              <span className="group-hover:hidden">T</span>
              <IconMenu className="hidden h-5 w-5 group-hover:block" />
            </button>
          </div>
        )}

        {/* Espaces de travail ("serveurs") */}
        <div className="shrink-0 space-y-1 px-3 pb-2">
          {showLabels && (
            <div className="px-1 pb-0.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Espaces
            </div>
          )}
          {topWorkspaces.map((w) => {
            const active = w.id === current?.id;
            const unread = w.unreadCount ?? 0;
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
                <span className="relative shrink-0">
                  <span
                    className={clsx(
                      'grid h-9 w-9 place-items-center text-xs font-bold text-white transition-all',
                      active ? 'rounded-xl' : 'rounded-2xl group-hover:rounded-xl',
                    )}
                    style={{ background: tint(w.id) }}
                  >
                    {initials(w.name)}
                  </span>
                  {unread > 0 && !active && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full border-2 border-[var(--rail)] bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {showLabels && (
                  <span className="min-w-0 flex-1 truncate text-left text-base font-semibold">{w.name}</span>
                )}
                {showLabels && unread > 0 && !active && (
                  <span className="ml-auto grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-2xs font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}

          {moreCount > 0 &&
            (() => {
              const hiddenUnread = orderedWorkspaces
                .slice(3)
                .reduce((n, w) => n + (w.unreadCount ?? 0), 0);
              return (
                <button
                  onClick={() => setWsModalOpen(true)}
                  title={`${moreCount} autre(s) espace(s)`}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg text-[var(--text-dim)] transition hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
                    showLabels ? 'w-full px-1.5 py-1' : 'w-full justify-center py-0.5',
                  )}
                >
                  <span className="relative shrink-0">
                    <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--surface-2)] text-2xs font-bold">
                      +{moreCount}
                    </span>
                    {hiddenUnread > 0 && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[var(--rail)] bg-red-500" />
                    )}
                  </span>
                  {showLabels && <span className="text-base font-medium">Voir plus ({moreCount})</span>}
                  {showLabels && hiddenUnread > 0 && (
                    <span className="ml-auto grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-2xs font-bold text-white">
                      {hiddenUnread > 99 ? '99+' : hiddenUnread}
                    </span>
                  )}
                </button>
              );
            })()}

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
            {showLabels && <span className="text-base font-medium">Nouvel espace</span>}
          </button>
        </div>

        <div className="mx-3 border-t border-[var(--outline)]" />

        {/* Navigation - defile si la hauteur est serree.
            Sur mobile / tablette elle vit dans la barre d'onglets du bas (BottomNav). */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {isDesktop &&
            NAV_ITEMS.map(({ to, label, end, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
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
                    <Icon className="h-[22px] w-[22px] shrink-0" />
                    {showLabels && label}
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        {/* Bas : compte (profil + parametres + deconnexion dans le menu) */}
        <div className="relative shrink-0 border-t border-[var(--outline)] p-3">
          <button
            onClick={() => setUserMenu((m) => !m)}
            className={clsx(
              'flex h-11 items-center gap-2 rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5',
              showLabels ? 'w-full px-2' : 'w-full justify-center',
              userMenu && 'bg-black/5 dark:bg-white/5',
            )}
            title={user?.fullName}
          >
            <span className="relative shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                {initials(user?.fullName)}
              </span>
              <PresenceDot state={ownDot} size={9} ring="var(--rail)" className="absolute bottom-0 right-0" />
            </span>
            {showLabels && (
              <>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-left text-base font-semibold">{user?.fullName}</span>
                  <span className="block truncate text-left text-2xs text-[var(--text-dim)]">
                    {user?.email}
                  </span>
                </span>
                <IconChevronDown
                  className={clsx(
                    'h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform',
                    !userMenu && 'rotate-180',
                  )}
                />
              </>
            )}
          </button>

          {userMenu && (
            <div className="absolute bottom-full left-3 right-3 z-30 mb-1 rounded-xl border border-[var(--outline)] bg-[var(--surface)] py-1 shadow-elevation-3">
              <button
                onClick={() => {
                  setUserMenu(false);
                  if (user) openProfile(user.id);
                }}
                className="flex w-full items-center gap-3 rounded-t-xl px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                  {initials(user?.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{user?.fullName}</span>
                  <span className="block truncate text-xs text-[var(--text-dim)]">Voir mon profil</span>
                </span>
              </button>

              {/* Changer le statut : sous-menu au survol */}
              <div className="group/st relative border-t border-[var(--outline)]">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-base transition hover:bg-black/5 dark:hover:bg-white/5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: DOT_COLOR[ownDot] }}
                  />
                  <span className="flex-1">Visibilité</span>
                  <span className="text-2xs text-[var(--text-dim)]">{DOT_LABEL[ownDot]}</span>
                  <IconChevronDown className="h-4 w-4 -rotate-90 text-[var(--text-dim)]" />
                </button>
                <div className="absolute bottom-0 left-full z-40 hidden pl-1 group-hover/st:block">
                  <div className="w-52 rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-1 shadow-elevation-3">
                    <StatusPicker compact onPick={() => setUserMenu(false)} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setUserMenu(false);
                  openSettings('profil');
                }}
                className="flex w-full items-center gap-2 border-t border-[var(--outline)] px-3 py-2 text-left text-base transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <IconPerson className="h-4 w-4" /> Modifier le profil
              </button>
              <button
                onClick={() => {
                  setUserMenu(false);
                  openSettings();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-base transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <IconSettings className="h-4 w-4" /> Parametres
              </button>
              <button
                onClick={() => {
                  setUserMenu(false);
                  setAutomationsOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-base transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <IconSettings className="h-4 w-4" /> Automatisation
              </button>
              <button
                onClick={() => {
                  setUserMenu(false);
                  setFriendsOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-base transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <IconFriends className="h-4 w-4" /> Amis
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-b-xl border-t border-[var(--outline)] px-3 py-2 text-left text-base text-red-600 transition hover:bg-red-500/10"
              >
                <IconLogout className="h-4 w-4" /> Se deconnecter
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <BottomNav />
      <IncomingCallModal />
      <FloatingUnread />
      <MessageNotifier />

      <WorkspacesModal open={wsModalOpen} onClose={() => setWsModalOpen(false)} />
      <FriendsModal open={friendsOpen} onClose={() => setFriendsOpen(false)} onMessage={messageFriend} />
      <AutomationsModal open={automationsOpen} onClose={() => setAutomationsOpen(false)} />
    </div>
  );
}
