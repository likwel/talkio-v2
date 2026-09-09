import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useSettings } from '@/context/SettingsContext';
import { usePresence, DOT_LABEL, DOT_COLOR } from '@/context/PresenceContext';
import StatusPicker from '@/components/StatusPicker';
import { useToast } from '@/context/ToastContext';
import type { Channel, UserProfile } from '@/lib/types';
import {
  IconPersonAdd,
  IconChat,
  IconTick,
  IconClose,
  IconEdit,
  IconCamera,
  IconAt,
  IconToday,
} from '@/lib/icons';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
const initials = (n: string) =>
  n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

const MAX_PHOTO = 1024 * 1024; // 1 Mo

export default function ProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { patchUser } = useAuth();
  const { current } = useWorkspace();
  const { openSettings } = useSettings();
  const { presenceOf } = usePresence();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [p, setP] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!userId) return;
    setP((await api.get<UserProfile>(`/users/${userId}`)).data);
  }

  useEffect(() => {
    setP(null);
    load();
    const s = getSocket();
    const onCh = () => load();
    s.on('friend:changed', onCh);
    return () => {
      s.off('friend:changed', onCh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function friendAction() {
    if (!p) return;
    setBusy(true);
    try {
      if (p.friendState === 'none') await api.post('/friends/request', { email: p.email });
      else if (p.friendState === 'incoming' && p.friendshipId) await api.post(`/friends/${p.friendshipId}/accept`);
      else if (p.friendState === 'outgoing') await api.delete(`/friends/${p.id}`);
      else if (p.friendState === 'friends') await api.delete(`/friends/${p.id}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!p || !current) return;
    try {
      const r = await api.post<Channel>(
        '/channels/direct',
        { workspaceId: current.id, userIds: [p.id] },
        { skipErrorToast: true },
      );
      onClose();
      navigate(`/chat/${r.data.id}`);
    } catch {
      toast("Cette personne ne fait pas partie de l'espace actif.", 'error');
    }
  }

  async function pickPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Fichier image attendu (PNG, JPG, WebP…).', 'error');
      return;
    }
    if (file.size > MAX_PHOTO) {
      toast('La photo dépasse la limite de 1 Mo.', 'error');
      return;
    }
    // Aperçu immédiat (avant même la fin de l'envoi).
    const localPreview = URL.createObjectURL(file);
    const previous = p?.avatarUrl ?? null;
    setP((prev) => (prev ? { ...prev, avatarUrl: localPreview } : prev));
    setPhotoBusy(true);
    try {
      const up = await api.post<{ url: string }>('/uploads', file, {
        headers: { 'Content-Type': file.type },
        params: { name: file.name },
      });
      const r = await api.patch('/auth/me', { avatarUrl: up.data.url });
      patchUser(r.data);
      setP((prev) => (prev ? { ...prev, avatarUrl: up.data.url } : prev));
      toast('Photo de profil mise à jour.', 'success');
    } catch {
      setP((prev) => (prev ? { ...prev, avatarUrl: previous } : prev)); // revert si échec
    } finally {
      URL.revokeObjectURL(localPreview);
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      const r = await api.patch('/auth/me', { avatarUrl: null });
      patchUser(r.data);
      setP((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    } finally {
      setPhotoBusy(false);
    }
  }

  const label: Record<string, string> = {
    none: 'Ajouter en ami',
    outgoing: 'Annuler la demande',
    incoming: 'Accepter la demande',
    friends: 'Retirer des amis',
    self: '',
  };

  const isSelf = p?.friendState === 'self';
  const dot = p ? presenceOf(p.id, p.presenceStatus) : 'offline';

  return (
    <Modal open={!!userId} onClose={onClose} size="md">
      {!p ? (
        <div className="py-10 text-center text-sm text-[var(--text-dim)]">Chargement…</div>
      ) : (
        <div className="-mx-5 -my-4">
          {/* ---------- En-tête façon Telegram ---------- */}
          <div className="relative h-60 w-full">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.fullName} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div
                className="absolute inset-0 grid place-items-center"
                style={{ background: `linear-gradient(150deg, ${tint(p.id)}, ${tint(p.id)}cc)` }}
              >
                <span className="font-display text-6xl font-black text-white/95">
                  {initials(p.fullName)}
                </span>
              </div>
            )}
            {/* dégradés haut / bas pour la lisibilité */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />

            <button
              onClick={onClose}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55"
              aria-label="Fermer"
            >
              <IconClose className="h-5 w-5" />
            </button>

            {isSelf && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-white shadow-elevation-2 transition hover:brightness-110 disabled:opacity-50"
                  title="Changer la photo (1 Mo max)"
                >
                  <IconCamera className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="truncate font-display text-2xl font-black tracking-tight">{p.fullName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
                <span className="h-2 w-2 rounded-full" style={{ background: DOT_COLOR[dot] }} />
                {isSelf ? 'Vous' : DOT_LABEL[dot]}
              </div>
            </div>
          </div>

          {/* ---------- Corps ---------- */}
          <div className="space-y-4 px-5 py-4">
            {isSelf && photoBusy && (
              <div className="text-xs text-[var(--text-dim)]">Envoi de la photo…</div>
            )}
            {isSelf && p.avatarUrl && !photoBusy && (
              <button onClick={removePhoto} className="text-xs font-medium text-red-500 hover:underline">
                Retirer la photo
              </button>
            )}

            <div className="overflow-hidden rounded-xl border border-[var(--outline)]">
              <InfoRow icon={<IconAt className="h-4 w-4" />} label="E-mail" value={p.email} />
              <InfoRow
                icon={<IconToday className="h-4 w-4" />}
                label="Membre depuis"
                value={new Date(p.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                last
              />
            </div>

            {p.sharedWorkspaces.length > 0 && (
              <div>
                <div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
                  Espaces en commun
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.sharedWorkspaces.map((w) => (
                    <span
                      key={w.id}
                      className="chip"
                      style={w.color ? { borderColor: w.color, color: w.color } : undefined}
                    >
                      {w.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isSelf ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-2)] p-3">
                  <StatusPicker />
                </div>
                <button
                  className="btn-outlined w-full"
                  onClick={() => {
                    onClose();
                    openSettings('profil');
                  }}
                >
                  <IconEdit className="h-4 w-4" /> Modifier mon profil
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={message}>
                  <IconChat className="h-4 w-4" /> Message
                </button>
                <button
                  className={p.friendState === 'friends' ? 'btn-outlined' : 'btn-tonal'}
                  onClick={friendAction}
                  disabled={busy}
                >
                  {p.friendState === 'friends' ? (
                    <IconClose className="h-4 w-4" />
                  ) : p.friendState === 'incoming' ? (
                    <IconTick className="h-4 w-4" />
                  ) : (
                    <IconPersonAdd className="h-4 w-4" />
                  )}
                  {label[p.friendState]}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-3 px-3.5 py-2.5 ' +
        (last ? '' : 'border-b border-[var(--outline)]')
      }
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--text-dim)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          {label}
        </span>
        <span className="block truncate text-sm">{value}</span>
      </span>
    </div>
  );
}
