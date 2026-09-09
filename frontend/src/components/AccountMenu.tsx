import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useSettings } from '@/context/SettingsContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { type PresenceDotState, DOT_COLOR } from '@/context/PresenceContext';
import { api } from '@/lib/api';
import { useT } from '@/i18n';
import Avatar from '@/components/Avatar';
import StatusPicker from '@/components/StatusPicker';
import FriendsModal from '@/components/FriendsModal';
import AutomationsModal from '@/components/AutomationsModal';
import {
  IconChevronDown,
  IconPerson,
  IconSettings,
  IconBolt,
  IconFriends,
  IconLogout,
} from '@/lib/icons';

interface Props {
  /** Affiche le nom + l'e-mail à côté de l'avatar. */
  showLabel?: boolean;
  /** Bord d'alignement du menu par rapport à l'avatar. */
  align?: 'left' | 'right';
  size?: number;
}

const MENU_W = 240;

/**
 * Menu de compte (façon Google) : avatar-icône placé en bout de barre d'en-tête,
 * menu déroulant rendu dans <body> pour ne pas être rogné ni passer sous le rail.
 */
export default function AccountMenu({ showLabel, align = 'right', size = 32 }: Props) {
  const { user, logout } = useAuth();
  const { openProfile } = useProfile();
  const { openSettings } = useSettings();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const t = useT();

  const [open, setOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const left = align === 'right' ? Math.max(8, b.right - MENU_W) : Math.min(b.left, window.innerWidth - MENU_W - 8);
    setPos({ top: b.bottom + 6, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [/* fermer si l'utilisateur change */ user?.id]);

  const ownDot: PresenceDotState =
    user?.presenceStatus === 'INVISIBLE'
      ? 'offline'
      : user?.presenceStatus === 'AWAY'
        ? 'away'
        : user?.presenceStatus === 'BUSY'
          ? 'busy'
          : 'online';

  async function messageFriend(userId: string) {
    if (!current) return;
    try {
      const r = await api.post(
        '/channels/direct',
        { workspaceId: current.id, userIds: [userId] },
        { skipErrorToast: true },
      );
      navigate(`/chat/${r.data.id}`);
    } catch {
      /* la personne n'est peut-être pas dans cet espace */
    }
  }

  const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5';

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex shrink-0 items-center gap-2 rounded-full transition hover:bg-black/5 dark:hover:bg-white/5',
          showLabel ? 'px-1.5 py-1' : 'p-0.5',
          open && 'bg-black/5 dark:bg-white/5',
        )}
        title={user?.fullName}
        aria-label={t('account.viewProfile')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar id={user?.id} name={user?.fullName} src={user?.avatarUrl} size={size} status={ownDot} ring="var(--rail)" />
        {showLabel && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-left text-sm font-semibold">{user?.fullName}</span>
              <span className="block truncate text-left text-2xs text-[var(--text-dim)]">{user?.email}</span>
            </span>
            <IconChevronDown
              className={clsx('h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform', open && 'rotate-180')}
            />
          </>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W, zIndex: 70 }}
            className="rounded-xl border border-[var(--outline)] bg-[var(--surface)] py-1 shadow-elevation-3"
          >
            <button
              onClick={() => {
                setOpen(false);
                if (user) openProfile(user.id);
              }}
              className="flex w-full items-center gap-3 rounded-t-xl px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Avatar id={user?.id} name={user?.fullName} src={user?.avatarUrl} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user?.fullName}</span>
                <span className="block truncate text-xs text-[var(--text-dim)]">{t('account.viewProfile')}</span>
              </span>
            </button>

            {/* Statut : sous-menu au survol */}
            <div className="group/st relative border-t border-[var(--outline)]">
              <button className={item}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT_COLOR[ownDot] }} />
                <span className="flex-1">{t(`presence.${ownDot}`)}</span>
                <IconChevronDown className="icon-3d h-4 w-4 -rotate-90 text-[var(--text-dim)]" />
              </button>
              <div className="absolute right-full top-0 z-40 hidden pr-1 group-hover/st:block">
                <div className="w-52 rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-1 shadow-elevation-3">
                  <StatusPicker compact onPick={() => setOpen(false)} />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setOpen(false);
                openSettings('profil');
              }}
              className={clsx(item, 'border-t border-[var(--outline)]')}
            >
              <IconPerson className="icon-3d h-4 w-4" /> {t('account.editProfile')}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                openSettings();
              }}
              className={item}
            >
              <IconSettings className="icon-3d h-4 w-4" /> {t('account.settings')}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setAutomationsOpen(true);
              }}
              className={item}
            >
              <IconBolt className="icon-3d h-4 w-4" /> {t('account.automation')}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setFriendsOpen(true);
              }}
              className={item}
            >
              <IconFriends className="icon-3d h-4 w-4" /> {t('account.friends')}
            </button>
            <button
              onClick={logout}
              className={clsx(
                item,
                'rounded-b-xl border-t border-[var(--outline)] text-red-600 hover:bg-red-500/10',
              )}
            >
              <IconLogout className="icon-3d h-4 w-4" /> {t('account.logout')}
            </button>
          </div>,
          document.body,
        )}

      <FriendsModal open={friendsOpen} onClose={() => setFriendsOpen(false)} onMessage={messageFriend} />
      <AutomationsModal open={automationsOpen} onClose={() => setAutomationsOpen(false)} />
    </>
  );
}
