import { FormEvent, ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useDialog } from '@/context/DialogContext';
import type { FriendRequest, User } from '@/lib/types';
import { IconPersonAdd, IconTick, IconClose, IconChat, IconFriends } from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

function Row({ user, children }: { user: User; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{ background: tint(user.id) }}
      >
        {initials(user.fullName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{user.fullName}</span>
        <span className="block truncate text-xs text-[var(--text-dim)]">{user.email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">{children}</span>
    </li>
  );
}

export default function FriendsModal({
  open,
  onClose,
  onMessage,
}: {
  open: boolean;
  onClose: () => void;
  onMessage: (userId: string) => void;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [reqs, setReqs] = useState<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    incoming: [],
    outgoing: [],
  });
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [f, r] = await Promise.all([api.get<User[]>('/friends'), api.get('/friends/requests')]);
    setFriends(f.data);
    setReqs(r.data);
  }

  useEffect(() => {
    if (!open) return;
    refresh();
    const socket = getSocket();
    const onChange = () => refresh();
    socket.on('friend:changed', onChange);
    return () => {
      socket.off('friend:changed', onChange);
    };
  }, [open]);

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/friends/request', { email: email.trim().toLowerCase() });
      setMsg({ kind: 'ok', text: 'Demande envoyee.' });
      setEmail('');
      refresh();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.response?.data?.error ?? 'Echec de la demande' });
    } finally {
      setBusy(false);
    }
  }

  const accept = (id: string) => api.post(`/friends/${id}/accept`).then(refresh);
  const decline = (id: string) => api.post(`/friends/${id}/decline`).then(refresh);
  async function remove(user: User) {
    const ok = await dialog.confirm({
      title: 'Retirer cet ami',
      message: `${user.fullName} sera retire de vos amis.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (ok) await api.delete(`/friends/${user.id}`).then(refresh);
  }

  const pendingCount = reqs.incoming.length;

  return (
    <Modal open={open} onClose={onClose} title="Amis">
      <div className="mb-3 flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-[13px] font-semibold">
        {(
          [
            ['friends', `Amis (${friends.length})`],
            ['requests', `Demandes${pendingCount ? ` (${pendingCount})` : ''}`],
            ['add', 'Ajouter'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex-1 rounded-md px-3 py-1.5 transition',
              tab === id ? 'bg-[var(--surface)] shadow-elevation-1' : 'text-[var(--text-dim)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'add' && (
        <form onSubmit={sendRequest} className="space-y-3">
          {msg && (
            <div
              className={clsx(
                'rounded-lg px-3 py-2 text-sm',
                msg.kind === 'ok'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300',
              )}
            >
              {msg.text}
            </div>
          )}
          <label className="block text-xs font-semibold text-[var(--text-dim)]">
            Email de la personne
            <input
              className="input mt-1"
              type="email"
              placeholder="ami@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn-primary" disabled={busy}>
            <IconPersonAdd className="h-4 w-4" /> Envoyer la demande
          </button>
        </form>
      )}

      {tab === 'requests' && (
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-dim)]">Recues</div>
            <ul>
              {reqs.incoming.map((r) => (
                <Row key={r.id} user={r.user}>
                  <button className="icon-btn-sm text-brand-600" title="Accepter" onClick={() => accept(r.id)}>
                    <IconTick className="h-5 w-5" />
                  </button>
                  <button className="icon-btn-sm text-red-500" title="Refuser" onClick={() => decline(r.id)}>
                    <IconClose className="h-5 w-5" />
                  </button>
                </Row>
              ))}
              {reqs.incoming.length === 0 && (
                <li className="px-2 py-2 text-sm text-[var(--text-dim)]">Aucune demande recue</li>
              )}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-dim)]">Envoyees</div>
            <ul>
              {reqs.outgoing.map((r) => (
                <Row key={r.id} user={r.user}>
                  <span className="chip">En attente</span>
                </Row>
              ))}
              {reqs.outgoing.length === 0 && (
                <li className="px-2 py-2 text-sm text-[var(--text-dim)]">Aucune demande envoyee</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === 'friends' && (
        <ul className="max-h-96 overflow-y-auto">
          {friends.map((u) => (
            <Row key={u.id} user={u}>
              <button
                className="btn-primary h-8 px-3 text-xs"
                onClick={() => {
                  onMessage(u.id);
                  onClose();
                }}
              >
                <IconChat className="h-4 w-4" /> Message
              </button>
              <button className="icon-btn-sm text-red-500" title="Retirer" onClick={() => remove(u)}>
                <IconClose className="h-5 w-5" />
              </button>
            </Row>
          ))}
          {friends.length === 0 && (
            <li className="flex flex-col items-center gap-2 py-8 text-center text-sm text-[var(--text-dim)]">
              <IconFriends className="h-8 w-8" />
              Aucun ami pour l'instant. Ajoutez-en par email.
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}
