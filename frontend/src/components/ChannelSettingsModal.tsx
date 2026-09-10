import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { useCrypto } from '@/context/CryptoContext';
import { useToast } from '@/context/ToastContext';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/context/ThemeContext';
import { WALLPAPERS } from '@/lib/wallpapers';
import Avatar from '@/components/Avatar';
import type { Automation, Channel, WorkspaceDetail } from '@/lib/types';
import { IconTick, IconBolt, IconForward } from '@/lib/icons';

type Perm = { canView: boolean; canRead: boolean; canWrite: boolean };

/**
 * Réglages du salon / de la conversation : nom, sujet, couleur, fond,
 * accusés de lecture, et les automatisations qui publient dans ce salon.
 * (Les membres sont gérés dans `ChannelMembersModal`.)
 */
export default function ChannelSettingsModal({
  channel,
  open,
  onClose,
  onChanged,
  onOpenAutomations,
}: {
  channel: Channel | undefined;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenAutomations?: () => void;
}) {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { openProfile } = useProfile();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState<string>('default');
  const [readReceipts, setReadReceipts] = useState(true);

  useEffect(() => {
    if (channel) {
      setName(channel.name ?? '');
      setTopic(channel.topic ?? '');
      setColor(channel.color ?? null);
      setWallpaper(channel.wallpaper ?? 'default');
      setReadReceipts(channel.readReceipts !== false);
    }
  }, [channel?.id, open]);

  // Seul le créateur peut changer les accusés de lecture (legacy sans créateur = autorisé).
  const isCreator = channel?.createdById ? channel.createdById === user?.id : true;
  const isDirect = channel?.type === 'DIRECT';

  // --- Permissions par membre ---
  const detail = useQuery({
    queryKey: ['channel', channel?.id],
    enabled: open && !!channel,
    queryFn: async () => (await api.get<Channel>(`/channels/${channel!.id}`)).data,
  });
  const wsDetail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && !isDirect && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });
  const permByUser = useMemo(() => {
    const m = new Map<string, Perm>();
    for (const r of detail.data?.members ?? channel?.members ?? []) {
      m.set(r.userId, {
        canView: r.canView !== false,
        canRead: r.canRead !== false,
        canWrite: r.canWrite !== false,
      });
    }
    return m;
  }, [detail.data, channel?.members]);

  async function setPerm(userId: string, patch: Partial<Perm>) {
    if (!channel) return;
    await api.patch(`/channels/${channel.id}/members/${userId}/permissions`, patch);
    detail.refetch();
    onChanged();
  }

  const automations = useQuery({
    queryKey: ['automations', current?.id],
    enabled: open && !!current,
    queryFn: async () =>
      (await api.get<Automation[]>('/automations', { params: { workspaceId: current!.id } })).data,
  });
  const linked = useMemo(
    () =>
      (automations.data ?? []).filter(
        (a) => a.actionType === 'message.post' && a.actionConfig?.channelId === channel?.id,
      ),
    [automations.data, channel?.id],
  );
  async function toggleAutomation(a: Automation) {
    await api.patch(`/automations/${a.id}`, { enabled: !a.enabled });
    automations.refetch();
  }

  async function save() {
    if (!channel) return;
    await api.patch(`/channels/${channel.id}`, {
      name: isDirect ? undefined : name.trim() || null,
      topic: topic.trim() || null,
      color,
      wallpaper: wallpaper === 'default' ? null : wallpaper,
      ...(isCreator ? { readReceipts } : {}),
    });
    onChanged();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isDirect ? 'Paramètres de la conversation' : 'Paramètres du salon'}
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-primary" onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!isDirect && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Nom</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Sujet</span>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Optionnel" />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">Couleur</span>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">
            Fond de conversation
          </span>
          <div className="grid grid-cols-6 gap-1.5">
            {WALLPAPERS.map((w) => {
              const cur = wallpaper === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWallpaper(w.id)}
                  title={w.label}
                  className={clsx(
                    'relative h-9 rounded-lg border-2 transition',
                    cur ? 'border-[var(--accent)]' : 'border-transparent hover:border-[var(--outline)]',
                  )}
                  style={{ background: theme === 'dark' ? w.dark : w.light }}
                >
                  {cur && <IconTick className="absolute inset-0 m-auto h-4 w-4 text-[var(--accent)]" />}
                </button>
              );
            })}
          </div>
        </div>

        <label
          className={clsx(
            'flex items-start gap-3 rounded-lg border border-[var(--outline)] p-2.5',
            !isCreator && 'opacity-60',
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            checked={readReceipts}
            disabled={!isCreator}
            onChange={(e) => setReadReceipts(e.target.checked)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Accusés de lecture (vu / lu)</span>
            <span className="block text-xs text-[var(--text-dim)]">
              {isCreator
                ? 'Affiche une double coche quand vos messages ont été lus par tout le monde.'
                : 'Seul le créateur de la conversation peut modifier ce réglage.'}
            </span>
          </span>
        </label>

        {channel && channel.type !== 'PUBLIC' && (
          <E2EESection
            channel={detail.data ?? channel}
            members={(detail.data?.members ?? []).map((m) => ({
              userId: m.userId,
              fullName: m.user?.fullName ?? m.userId,
            }))}
            selfId={user?.id}
            onChanged={() => {
              detail.refetch();
              onChanged();
            }}
          />
        )}

        {!isDirect && (
          <div className="border-t border-[var(--outline)] pt-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Permissions des membres
            </div>
            <p className="mb-2 text-xs text-[var(--text-dim)]">
              Tous les membres de l'espace sont dans ce salon. Ajustez qui peut le voir, le lire
              et y écrire — sans jamais retirer personne de l'espace.
            </p>
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-1">
              <span />
              <span className="text-2xs font-semibold text-[var(--text-dim)]">Vue</span>
              <span className="text-2xs font-semibold text-[var(--text-dim)]">Lecture</span>
              <span className="text-2xs font-semibold text-[var(--text-dim)]">Écrit.</span>
              {(wsDetail.data?.members ?? []).map((m) => {
                const p = permByUser.get(m.user.id) ?? { canView: true, canRead: true, canWrite: true };
                const self = m.user.id === user?.id;
                return (
                  <PermRow
                    key={m.user.id}
                    name={m.user.fullName}
                    userId={m.user.id}
                    avatarUrl={m.user.avatarUrl}
                    perm={p}
                    disabled={self}
                    onProfile={() => openProfile(m.user.id)}
                    onChange={(patch) => setPerm(m.user.id, patch)}
                  />
                );
              })}
            </div>
            {wsDetail.isLoading && (
              <div className="py-2 text-xs text-[var(--text-dim)]">Chargement…</div>
            )}
          </div>
        )}

        <div className="border-t border-[var(--outline)] pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Automatisations liées
            </span>
            {onOpenAutomations && (
              <button
                className="text-2xs font-semibold text-[var(--accent)] hover:underline"
                onClick={() => {
                  onClose();
                  onOpenAutomations();
                }}
              >
                Gérer
              </button>
            )}
          </div>
          {linked.length === 0 ? (
            <p className="text-xs text-[var(--text-dim)]">Aucune règle ne publie dans ce salon.</p>
          ) : (
            <ul className="space-y-1">
              {linked.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-2.5 py-2"
                >
                  <IconBolt className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="flex items-center gap-1 text-2xs text-[var(--text-dim)]">
                      {a.triggerType}
                      <IconForward className="h-3 w-3" />
                      message
                    </span>
                  </span>
                  <button
                    onClick={() => toggleAutomation(a)}
                    className={clsx(
                      'relative h-5 w-9 shrink-0 rounded-full transition',
                      a.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--outline)]',
                    )}
                    title={a.enabled ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                        a.enabled ? 'left-4' : 'left-0.5',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function PermRow({
  name,
  userId,
  avatarUrl,
  perm,
  disabled,
  onProfile,
  onChange,
}: {
  name: string;
  userId: string;
  avatarUrl?: string | null;
  perm: Perm;
  disabled?: boolean;
  onProfile: () => void;
  onChange: (patch: Partial<Perm>) => void;
}) {
  const box = (checked: boolean, key: keyof Perm) => (
    <input
      type="checkbox"
      className="h-4 w-4 accent-[var(--accent)] disabled:opacity-40"
      checked={checked}
      disabled={disabled}
      onChange={(e) => {
        // Retirer la vue retire aussi lecture/écriture ; les redonner rend la vue.
        if (key === 'canView' && !e.target.checked) onChange({ canView: false, canRead: false, canWrite: false });
        else if (key !== 'canView' && e.target.checked) onChange({ [key]: true, canView: true } as Partial<Perm>);
        else onChange({ [key]: e.target.checked } as Partial<Perm>);
      }}
    />
  );
  return (
    <>
      <button
        onClick={onProfile}
        className="flex items-center gap-2 truncate py-1 text-left text-sm hover:underline"
      >
        <Avatar id={userId} name={name} src={avatarUrl} size={24} />
        <span className="truncate">{name}</span>
      </button>
      <span className="grid place-items-center">{box(perm.canView, 'canView')}</span>
      <span className="grid place-items-center">{box(perm.canRead && perm.canView, 'canRead')}</span>
      <span className="grid place-items-center">{box(perm.canWrite && perm.canView, 'canWrite')}</span>
    </>
  );
}

/** Activation du chiffrement de bout en bout pour une conversation privée / directe. */
function E2EESection({
  channel,
  members,
  selfId,
  onChanged,
}: {
  channel: Channel;
  members: { userId: string; fullName: string }[];
  selfId?: string;
  onChanged: () => void;
}) {
  const { status, enableChannelE2EE } = useCrypto();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const on = !!channel.e2ee;
  const ids = Array.from(new Set([...(members.map((m) => m.userId)), ...(selfId ? [selfId] : [])]));

  async function enable() {
    setBusy(true);
    try {
      await enableChannelE2EE(channel.id, ids);
      toast('Chiffrement de bout en bout activé', 'success');
      onChanged();
    } catch (e: any) {
      if (e?.message === 'missing-keys') {
        const names = (e.missing as string[])
          .map((id) => members.find((m) => m.userId === id)?.fullName ?? 'un membre')
          .join(', ');
        toast(`Ces membres n'ont pas encore activé le chiffrement : ${names}`, 'error');
      } else {
        toast(e?.response?.data?.error ?? e?.message ?? 'Échec de l’activation', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--outline)] p-2.5">
      <span className="block text-sm font-medium">Chiffrement de bout en bout</span>
      {on ? (
        <p className="mt-0.5 text-xs text-[var(--text-dim)]">
          Actif{channel.e2eeSince ? ` depuis le ${new Date(channel.e2eeSince).toLocaleDateString('fr-FR')}` : ''}.
          Les messages antérieurs restent en clair. Le chiffrement ne peut pas être désactivé.
        </p>
      ) : status !== 'ready' ? (
        <p className="mt-0.5 text-xs text-[var(--text-dim)]">
          Configurez d’abord votre chiffrement dans Paramètres → Sécurité.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-[var(--text-dim)]">
            Le serveur ne pourra plus lire les messages. Pièces jointes et recherche serveur désactivées.
          </p>
          <button type="button" className="btn-primary btn-sm mt-2" disabled={busy} onClick={enable}>
            {busy ? 'Activation…' : 'Activer'}
          </button>
        </>
      )}
    </div>
  );
}
