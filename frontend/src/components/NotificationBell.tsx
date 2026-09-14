import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useNotifications } from '@/context/NotificationsContext';
import type { AppNotification, NotificationType } from '@/lib/types';
import Avatar from '@/components/Avatar';
import {
  IconBell,
  IconBellActive,
  IconFriends,
  IconPersonAdd,
  IconKanban,
  IconError,
  IconAnalytics,
  IconForms,
  IconClose,
  IconTick,
  IconTime,
} from '@/lib/icons';

const TYPE_ICON: Record<NotificationType, typeof IconBell> = {
  FRIEND_REQUEST: IconPersonAdd,
  FRIEND_ACCEPTED: IconFriends,
  PROJECT_ASSIGNED: IconKanban,
  RISK_ASSIGNED: IconError,
  MEASUREMENT_ADDED: IconAnalytics,
  FORM_RESPONSE: IconForms,
  FORM_ASSIGNED: IconForms,
  ACTIVITY_OVERDUE: IconTime,
  GENERIC: IconBell,
};

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "a l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export default function NotificationBell({
  className,
  panelSide = 'down',
}: {
  className?: string;
  /** Cote d'ouverture du panneau selon l'emplacement du bouton. */
  panelSide?: 'down' | 'left' | 'up';
}) {
  const { items, unread, markRead, markAllRead, remove, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  function activate(n: AppNotification) {
    if (!n.readAt) markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  }

  async function answerFriend(n: AppNotification, accept: boolean) {
    if (!n.entityId || busy) return;
    setBusy(n.id);
    try {
      await api.post(`/friends/${n.entityId}/${accept ? 'accept' : 'decline'}`);
      await markRead(n.id);
      await remove(n.id);
    } catch {
      /* deja traitee */
      await remove(n.id);
    } finally {
      setBusy(null);
    }
  }

  async function answerFormInvite(n: AppNotification, accept: boolean) {
    if (!n.entityId || busy) return;
    setBusy(n.id);
    try {
      const r = await api.post<{ formId?: string }>(
        `/forms/assignments/${n.entityId}/${accept ? 'accept' : 'decline'}`,
      );
      await markRead(n.id);
      await remove(n.id);
      if (accept && r.data?.formId) {
        navigate(`/forms/${r.data.formId}/fill`);
        setOpen(false);
      }
    } catch {
      await remove(n.id);
    } finally {
      setBusy(null);
    }
  }

  const panelPos =
    panelSide === 'left'
      ? 'right-full top-0 mr-2'
      : panelSide === 'up'
        ? 'bottom-full right-0 mb-2'
        : 'top-full right-0 mt-2';

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'relative grid h-9 w-9 place-items-center rounded-xl text-[var(--text-dim)] transition hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/10',
          open && 'bg-black/5 text-[var(--text)] dark:bg-white/10',
        )}
        aria-label="Notifications"
        title="Notifications"
      >
        {unread > 0 ? <IconBellActive className="h-5 w-5" /> : <IconBell className="h-5 w-5" />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full border-2 border-[var(--rail)] bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={clsx(
            'absolute z-50 w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)] shadow-elevation-3',
            panelPos,
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--outline)] px-3 py-2">
            <span className="text-sm font-bold">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button className="btn-text btn-sm" onClick={() => markAllRead()}>
                  Tout marquer lu
                </button>
              )}
              {items.length > 0 && (
                <button className="btn-text btn-sm" onClick={() => clearAll()} title="Tout effacer">
                  Effacer
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-[var(--text-dim)]">Aucune notification</li>
            )}
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? IconBell;
              const isFriendReq = n.type === 'FRIEND_REQUEST' && !!n.entityId;
              const isFormInvite =
                n.type === 'FORM_ASSIGNED' && n.entityType === 'formAssignee' && !!n.entityId;
              const hasInlineActions = isFriendReq || isFormInvite;
              return (
                <li
                  key={n.id}
                  className={clsx(
                    'group relative flex gap-2.5 border-b border-[var(--outline)] px-3 py-2.5 last:border-b-0',
                    !n.readAt && 'bg-[var(--accent-softer)]',
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {n.actor ? (
                      <Avatar id={n.actor.id} name={n.actor.fullName} src={n.actor.avatarUrl} size={30} />
                    ) : (
                      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => activate(n)}
                      className="block w-full text-left"
                      disabled={hasInlineActions && !n.readAt}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
                        <span className={clsx('truncate text-sm', !n.readAt ? 'font-semibold' : 'font-medium')}>
                          {n.title}
                        </span>
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">{n.body}</span>
                      )}
                      <span className="mt-0.5 block text-2xs text-[var(--text-dim)]">{ago(n.createdAt)}</span>
                    </button>

                    {hasInlineActions && !n.readAt && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          className="btn-primary btn-sm"
                          disabled={busy === n.id}
                          onClick={() =>
                            isFormInvite ? answerFormInvite(n, true) : answerFriend(n, true)
                          }
                        >
                          <IconTick className="h-4 w-4" /> Accepter
                        </button>
                        <button
                          className="btn-outlined btn-sm"
                          disabled={busy === n.id}
                          onClick={() =>
                            isFormInvite ? answerFormInvite(n, false) : answerFriend(n, false)
                          }
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => remove(n.id)}
                    className="absolute right-1.5 top-1.5 hidden rounded p-0.5 text-[var(--text-dim)] hover:text-red-500 group-hover:block"
                    title="Retirer"
                  >
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
