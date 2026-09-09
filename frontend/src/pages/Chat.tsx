import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useDialog } from '@/context/DialogContext';
import { usePresence, DOT_LABEL } from '@/context/PresenceContext';
import type { ActiveCall, Attachment, Channel, Message } from '@/lib/types';
import {
  IconAdd,
  IconCall,
  IconVideo,
  IconSearch,
  IconSend,
  IconHash,
  IconGroups,
  IconCallFill,
  IconVideoFill,
  IconFriends,
  IconBack,
  IconSettings,
  IconAttach,
  IconFile,
  IconDownload,
  IconClose,
  IconEdit,
  IconDelete,
  IconReply,
  IconShare,
  IconTick,
  IconDone,
  IconDoneAll,
} from '@/lib/icons';
import Modal from '@/components/Modal';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import AccountMenu from '@/components/AccountMenu';
import { useTheme } from '@/context/ThemeContext';
import { wallpaperStyle } from '@/lib/wallpapers';
import NewConversationModal from '@/components/NewConversationModal';
import FriendsModal from '@/components/FriendsModal';
import ChannelSettingsModal from '@/components/ChannelSettingsModal';
import ChannelMembersModal from '@/components/ChannelMembersModal';
import WorkspaceSettingsModal from '@/components/WorkspaceSettingsModal';
import AutomationsModal from '@/components/AutomationsModal';
import { useImageViewer } from '@/components/ImageViewer';
import Avatar, { avatarColor as avColor } from '@/components/Avatar';

function sameDay(a: string | Date, b: string | Date) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Aujourd'hui";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return 'Hier';
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}


export default function Chat() {
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { channelId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [addingSalon, setAddingSalon] = useState(false);
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [chanSettingsOpen, setChanSettingsOpen] = useState(false);
  const [wsSettingsOpen, setWsSettingsOpen] = useState(false);
  const [newChannel, setNewChannel] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [mention, setMention] = useState<{ from: number; query: string } | null>(null);
  const [sharing, setSharing] = useState<Message | null>(null);
  const { openProfile } = useProfile();
  const { presenceOf } = usePresence();
  const { theme } = useTheme();
  const dialog = useDialog();
  const [membersOpen, setMembersOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  // Mobile : on affiche soit la liste, soit la conversation
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(channelId ? 'thread' : 'list');
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX_UPLOAD = 2 * 1024 * 1024;

  useEffect(() => {
    setMobileView(channelId ? 'thread' : 'list');
  }, [channelId]);

  const channels = useQuery({
    queryKey: ['channels', current?.id],
    enabled: !!current,
    refetchInterval: 30_000,
    queryFn: async () => (await api.get<Channel[]>('/channels', { params: { workspaceId: current!.id } })).data,
  });

  const activeCalls = useQuery({
    queryKey: ['activeCalls', current?.id],
    enabled: !!current,
    queryFn: async () =>
      (await api.get<ActiveCall[]>('/calls/active', { params: { workspaceId: current!.id } })).data,
  });
  const callByChannel = useMemo(() => {
    const m = new Map<string, ActiveCall>();
    (activeCalls.data ?? []).forEach((c) => m.set(c.channelId, c));
    return m;
  }, [activeCalls.data]);

  useEffect(() => {
    if (!current) return;
    const socket = getSocket();
    const sub = () => socket.emit('calls:subscribe', current.id);
    sub();
    socket.on('connect', sub);
    const onChange = () => {
      qc.invalidateQueries({ queryKey: ['activeCalls'] });
      // Rafraichit le fil pour mettre a jour les evenements d'appel (duree, "termine").
      qc.invalidateQueries({ queryKey: ['messages'] });
    };
    socket.on('calls:active-changed', onChange);
    return () => {
      socket.emit('calls:unsubscribe', current.id);
      socket.off('connect', sub);
      socket.off('calls:active-changed', onChange);
    };
  }, [current, qc]);

  const salons = useMemo(() => (channels.data ?? []).filter((c) => c.type !== 'DIRECT'), [channels.data]);
  const dms = useMemo(() => (channels.data ?? []).filter((c) => c.type === 'DIRECT'), [channels.data]);

  const activeId = channelId || salons[0]?.id;
  const activeChannel = channels.data?.find((c) => c.id === activeId);

  // --- Accuses de lecture (vu / lu) ---
  const otherMembers = useMemo(
    () => (activeChannel?.members ?? []).filter((m) => m.userId !== user?.id),
    [activeChannel?.members, user?.id],
  );
  const receiptsOn = activeChannel?.readReceipts !== false;
  const isReadByAll = (m: Message) =>
    otherMembers.length > 0 &&
    otherMembers.every(
      (mm) =>
        mm.lastReadAt && new Date(mm.lastReadAt).getTime() >= new Date(m.createdAt).getTime(),
    );

  const dmPartner = (c?: Channel) =>
    c?.type === 'DIRECT' ? c.members?.find((m) => m.userId !== user?.id)?.user : undefined;
  const isGroup = (c?: Channel) => c?.type === 'DIRECT' && (c.members?.length ?? 0) > 2;
  const groupTitle = (c: Channel) =>
    c.name ||
    (c.members ?? [])
      .filter((m) => m.userId !== user?.id)
      .map((m) => m.user.fullName.split(' ')[0])
      .join(', ');
  const channelTitle = (c?: Channel) =>
    !c
      ? '—'
      : c.type !== 'DIRECT'
        ? c.name ?? 'salon'
        : isGroup(c)
          ? groupTitle(c)
          : dmPartner(c)?.fullName ?? 'Message direct';

  const messages = useQuery({
    queryKey: ['messages', activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await api.get<{ items: Message[] }>('/messages', { params: { channelId: activeId } })).data.items,
  });

  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    socket.emit('channel:subscribe', activeId);
    const onNew = (m: Message) => {
      if (m.channelId === activeId) {
        qc.setQueryData<Message[]>(['messages', activeId], (old = []) => [...old, m]);
        api.post(`/channels/${activeId}/read`).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ['channels', current?.id] });
    };
    const onUpdated = (m: Message) => {
      if (m.channelId !== activeId) return;
      qc.setQueryData<Message[]>(['messages', activeId], (old = []) =>
        old.map((x) => (x.id === m.id ? m : x)),
      );
    };
    const onDeleted = ({ id }: { id: string }) => {
      qc.setQueryData<Message[]>(['messages', activeId], (old = []) => old.filter((x) => x.id !== id));
      qc.invalidateQueries({ queryKey: ['channels', current?.id] });
    };
    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    return () => {
      socket.emit('channel:unsubscribe', activeId);
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
    };
  }, [activeId, qc, current?.id]);

  // Marque le salon comme lu a l'ouverture.
  useEffect(() => {
    if (!activeId) return;
    api
      .post(`/channels/${activeId}/read`)
      .then(() => qc.invalidateQueries({ queryKey: ['channels', current?.id] }))
      .catch(() => {});
  }, [activeId, qc, current?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [draft]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError('');
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD) {
        setUploadError(`« ${file.name} » depasse la limite de 2 Mo.`);
        continue;
      }
      setUploading(true);
      try {
        const r = await api.post<Attachment>('/uploads', file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          params: { name: file.name },
        });
        setPending((a) => [...a, r.data]);
      } catch {
        setUploadError("Echec de l'envoi du fichier.");
      } finally {
        setUploading(false);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send() {
    const body = draft.trim();
    if ((!body && pending.length === 0) || !activeId || uploading) return;
    const atts = pending.map(({ url, name, mimeType, size }) => ({ url, name, mimeType, size }));
    const parentId = replyTo?.id;
    setDraft('');
    setPending([]);
    setUploadError('');
    setReplyTo(null);
    setMention(null);
    await api.post('/messages', { channelId: activeId, body, attachments: atts, parentId });
    qc.invalidateQueries({ queryKey: ['channels', current?.id] });
  }

  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    const { id, body } = editing;
    setEditing(null);
    await api.patch(`/messages/${id}`, { body: body.trim() });
  }

  async function deleteMessage(m: Message) {
    const ok = await dialog.confirm({
      title: 'Supprimer le message',
      message: 'Ce message sera definitivement supprime.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await api.delete(`/messages/${m.id}`);
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setReplyTo(null);
      setMention(null);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (mention && mentionCandidates.length) {
        e.preventDefault();
        insertMention(mentionCandidates[0].fullName);
        return;
      }
      e.preventDefault();
      send();
    }
  }

  /** Detecte `@mot` en cours de frappe pour proposer les membres. */
  function onDraftChange(value: string, caret: number) {
    setDraft(value);
    const m = value.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
    if (m) setMention({ from: caret - m[1].length - 1, query: m[1].toLowerCase() });
    else setMention(null);
  }

  function insertMention(name: string) {
    if (!mention) return;
    const first = name.split(/\s+/)[0];
    const before = draft.slice(0, mention.from);
    const after = draft.slice(mention.from).replace(/^@[^\s@]*/, '').replace(/^\s+/, '');
    const inserted = `@${first} `;
    const next = `${before}${inserted}${after}`;
    const caret = before.length + inserted.length; // juste après « @Nom  »
    setDraft(next);
    setMention(null);
    setTimeout(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    }, 0);
  }

  async function createSalon(e: FormEvent) {
    e.preventDefault();
    if (!newChannel.trim() || !current) return;
    const r = await api.post<Channel>('/channels', { workspaceId: current.id, name: newChannel.trim() });
    setNewChannel('');
    setAddingSalon(false);
    await channels.refetch();
    navigate(`/chat/${r.data.id}`);
  }

  async function onConversationCreated(c: Channel) {
    await channels.refetch();
    navigate(`/chat/${c.id}`);
  }

  async function startDmWith(userId: string) {
    if (!current) return;
    try {
      const r = await api.post<Channel>(
        '/channels/direct',
        { workspaceId: current.id, userIds: [userId] },
        { skipErrorToast: true },
      );
      await channels.refetch();
      navigate(`/chat/${r.data.id}`);
    } catch {
      /* la personne n'est peut-etre pas dans cet espace */
    }
  }

  async function startCall(type: 'AUDIO' | 'VIDEO') {
    if (!current || !activeId) return;
    const r = await api.post('/calls', { workspaceId: current.id, channelId: activeId, type });
    navigate(`/call/${r.data.roomId}`);
  }

  const q = filter.trim().toLowerCase();
  const filtSalons = q ? salons.filter((c) => (c.name ?? '').toLowerCase().includes(q)) : salons;
  const filtDms = q ? dms.filter((c) => channelTitle(c).toLowerCase().includes(q)) : dms;

  const groups = useMemo(() => groupMessages(messages.data ?? []), [messages.data]);
  const activeRoomIds = useMemo(
    () => new Set((activeCalls.data ?? []).map((c) => c.roomId)),
    [activeCalls.data],
  );

  const headerCall = activeId ? callByChannel.get(activeId) : undefined;
  const memberCount =
    activeChannel?.activeMemberCount ??
    activeChannel?._count?.members ??
    activeChannel?.members?.length ??
    0;

  const memberUsers = useMemo(
    () => (activeChannel?.members ?? []).map((m) => m.user),
    [activeChannel],
  );
  const mentionNames = useMemo(
    () => new Set(memberUsers.map((u) => u.fullName.split(/\s+/)[0].toLowerCase())),
    [memberUsers],
  );
  const mentionCandidates =
    mention && mention.query
      ? memberUsers.filter((u) => u.fullName.toLowerCase().includes(mention.query)).slice(0, 6)
      : memberUsers.slice(0, 6);

  function renderBody(text: string) {
    return text.split(/(@[^\s@]+)/g).map((part, i) =>
      part[0] === '@' && mentionNames.has(part.slice(1).toLowerCase()) ? (
        <span
          key={i}
          className="rounded bg-[var(--accent-soft)] px-0.5 font-semibold text-[var(--accent-strong)]"
        >
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="flex h-full">
      {/* ---------- Conversations ---------- */}
      <div
        className={clsx(
          'flex w-full shrink-0 flex-col border-r border-[var(--outline)] bg-[var(--surface)] lg:w-[288px]',
          mobileView === 'thread' && 'hidden lg:flex',
        )}
      >
        <div className="border-b border-[var(--outline)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <WorkspaceSwitcher />
            <button className="icon-btn-sm" title="Amis" onClick={() => setFriendsOpen(true)}>
              <IconFriends className="h-[18px] w-[18px]" />
            </button>
            <button className="icon-btn-sm" title="Parametres de l'espace" onClick={() => setWsSettingsOpen(true)}>
              <IconSettings className="h-[18px] w-[18px]" />
            </button>
            <AccountMenu align="right" size={26} />
          </div>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              className="input h-9 pl-8 text-base"
              placeholder="Rechercher"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <SectionHeader label="Salons" onAdd={() => setAddingSalon((v) => !v)} />
          {addingSalon && (
            <form onSubmit={createSalon} className="px-1 pb-1">
              <input
                autoFocus
                className="input h-9 text-base"
                placeholder="nom-du-salon"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
              />
            </form>
          )}
          <ul className="mb-3">
            {filtSalons.map((c) => (
              <ConvItem
                key={c.id}
                active={c.id === activeId}
                onClick={() => navigate(`/chat/${c.id}`)}
                icon={
                  c.color ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  ) : (
                    <IconHash className="h-4 w-4 opacity-70" />
                  )
                }
                label={c.name ?? 'salon'}
                call={callByChannel.get(c.id)}
                unread={c.unreadCount}
              />
            ))}
            {filtSalons.length === 0 && <li className="px-3 py-1 text-sm text-[var(--text-dim)]">Aucun salon</li>}
          </ul>

          <SectionHeader label="Messages directs" onAdd={() => setDmModalOpen(true)} />
          <ul>
            {filtDms.map((c) => {
              const grp = isGroup(c);
              const p = dmPartner(c);
              return (
                <ConvItem
                  key={c.id}
                  active={c.id === activeId}
                  onClick={() => navigate(`/chat/${c.id}`)}
                  icon={
                    grp ? (
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-[var(--surface-2)]">
                        <IconGroups className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <Avatar
                        id={p?.id ?? c.id}
                        name={p?.fullName}
                        src={p?.avatarUrl}
                        size={22}
                        status={p ? presenceOf(p.id, p.presenceStatus) : undefined}
                      />
                    )
                  }
                  label={channelTitle(c)}
                  call={callByChannel.get(c.id)}
                  unread={c.unreadCount}
                />
              );
            })}
            {filtDms.length === 0 && (
              <li className="px-3 py-1 text-sm text-[var(--text-dim)]">Aucune conversation</li>
            )}
          </ul>
        </div>
      </div>

      <NewConversationModal
        open={dmModalOpen}
        onClose={() => setDmModalOpen(false)}
        onCreated={onConversationCreated}
      />
      <FriendsModal open={friendsOpen} onClose={() => setFriendsOpen(false)} onMessage={startDmWith} />
      <ChannelSettingsModal
        channel={activeChannel}
        open={chanSettingsOpen}
        onClose={() => setChanSettingsOpen(false)}
        onChanged={() => channels.refetch()}
        onOpenAutomations={() => setAutoModalOpen(true)}
      />
      <ChannelMembersModal
        channel={activeChannel}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        onChanged={() => channels.refetch()}
      />
      <WorkspaceSettingsModal open={wsSettingsOpen} onClose={() => setWsSettingsOpen(false)} />
      <AutomationsModal open={autoModalOpen} onClose={() => setAutoModalOpen(false)} />
      <ShareModal
        message={sharing}
        channels={channels.data ?? []}
        currentUserId={user?.id}
        onClose={() => setSharing(null)}
        onShared={() => qc.invalidateQueries({ queryKey: ['channels', current?.id] })}
      />

      {/* ---------- Chat ---------- */}
      <div
        className={clsx(
          'flex min-w-0 flex-1 flex-col bg-[var(--bg)]',
          mobileView === 'list' && 'hidden lg:flex',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--outline)] px-3 sm:px-4">
          <button
            className="icon-btn -ml-1 lg:hidden"
            onClick={() => {
              setMobileView('list');
              navigate('/');
            }}
            aria-label="Retour"
          >
            <IconBack className="h-5 w-5" />
          </button>
          {(() => {
            const partner =
              activeChannel && activeChannel.type === 'DIRECT' && !isGroup(activeChannel)
                ? dmPartner(activeChannel)
                : undefined;
            if (partner) {
              const st = presenceOf(partner.id, partner.presenceStatus);
              return (
                <>
                  <button onClick={() => openProfile(partner.id)} className="shrink-0" title="Voir le profil">
                    <Avatar id={partner.id} name={partner.fullName} src={partner.avatarUrl} size={34} status={st} />
                  </button>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate font-display text-md font-bold">{partner.fullName}</div>
                    <div className="truncate text-2xs text-[var(--text-dim)]">{DOT_LABEL[st]}</div>
                  </div>
                </>
              );
            }
            return (
              <>
                {activeChannel?.color ? (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: activeChannel.color }}
                  />
                ) : activeChannel?.type !== 'DIRECT' ? (
                  <IconHash className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
                ) : (
                  <IconGroups className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
                )}
                <span className="min-w-0 flex-1 truncate font-display text-md font-bold">
                  {channelTitle(activeChannel)}
                </span>
              </>
            );
          })()}
          {activeChannel?.topic && (
            <>
              <span className="hidden h-4 w-px shrink-0 bg-[var(--outline)] xl:block" />
              <span className="hidden max-w-[240px] shrink truncate text-sm text-[var(--text-dim)] xl:block">
                {activeChannel.topic}
              </span>
            </>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--outline)] bg-[var(--surface)] p-0.5">
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              title="Appel audio"
              onClick={() => startCall('AUDIO')}
            >
              <IconCall className="h-[18px] w-[18px]" />
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
              title="Visio"
              onClick={() => startCall('VIDEO')}
            >
              <IconVideo className="h-[18px] w-[18px]" />
            </button>
            <span className="mx-0.5 h-4 w-px bg-[var(--outline)]" />
            <button
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="Membres du salon"
              onClick={() => setMembersOpen(true)}
            >
              <IconGroups className="h-[18px] w-[18px]" />
              {memberCount > 0 && <span>{memberCount}</span>}
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              title="Paramètres du salon"
              onClick={() => setChanSettingsOpen(true)}
            >
              <IconSettings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {headerCall && (
          <button
            onClick={() => navigate(`/call/${headerCall.roomId}`)}
            className="flex items-center gap-2 border-b border-[var(--outline)] bg-[var(--accent-soft)] px-4 py-2 text-left text-sm font-semibold text-brand-700 transition hover:bg-[var(--accent-soft)] dark:text-brand-300"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            </span>
            {headerCall.type === 'VIDEO' ? 'Visio en cours' : 'Appel en cours'} · {headerCall.participants} participant(s)
            <span className="ml-auto rounded-full bg-[var(--accent)] px-3 py-1 text-white">Rejoindre</span>
          </button>
        )}

        <div
          className="chat-bg min-h-0 flex-1 overflow-y-auto overflow-x-clip px-3 pb-4 pt-6 sm:px-4"
          style={wallpaperStyle(activeChannel?.wallpaper, theme)}
        >
          {messages.isLoading && <div className="text-sm text-[var(--text-dim)]">Chargement…</div>}
          {messages.data?.length === 0 && (
            <div className="grid h-full place-items-center text-center text-[var(--text-dim)]">
              <div>
                <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)]">
                  <IconHash className="h-6 w-6" />
                </div>
                Debut de la conversation
              </div>
            </div>
          )}
          <div className="space-y-2">
            {groups.map((g, gi) => {
              const mine = g.author.id === user?.id;
              const groupish = activeChannel?.type !== 'DIRECT' || isGroup(activeChannel);
              const callMsg = g.items[0].kind === 'CALL' ? g.items[0] : null;
              const prevG = groups[gi - 1];
              const prevAt = prevG?.items[prevG.items.length - 1]?.createdAt;
              const dayEl =
                !prevAt || !sameDay(prevAt, g.items[0].createdAt) ? (
                  <div className="date-chip">{dayLabel(g.items[0].createdAt)}</div>
                ) : null;
              if (callMsg) {
                return (
                  <Fragment key={gi}>
                    {dayEl}
                    <CallEvent
                      m={callMsg}
                      mine={mine}
                      live={!!callMsg.call && activeRoomIds.has(callMsg.call.roomId)}
                      onJoin={() => callMsg.call && navigate(`/call/${callMsg.call.roomId}`)}
                    />
                  </Fragment>
                );
              }
              return (
                <Fragment key={gi}>
                  {dayEl}
                  <div
                    className={clsx('flex items-end gap-2', mine && 'flex-row-reverse')}
                  >
                  {!mine && groupish ? (
                    <button
                      onClick={() => openProfile(g.author.id)}
                      className="shrink-0 self-end"
                      title="Voir le profil"
                    >
                      <Avatar
                        id={g.author.id}
                        name={g.author.fullName}
                        src={g.author.avatarUrl}
                        size={28}
                        status={presenceOf(g.author.id, g.author.presenceStatus)}
                      />
                    </button>
                  ) : (
                    !mine && <span className="w-2 shrink-0" />
                  )}
                  <div
                    className={clsx(
                      'flex min-w-0 flex-col gap-0.5',
                      mine ? 'items-end' : 'items-start',
                    )}
                  >
                    <div className="contents">
                      {g.items.map((m, mi) => {
                        const isEditing = editing?.id === m.id;
                        return (
                          <div
                            key={m.id}
                            className={clsx(
                              'msg-bubble group/msg',
                              mine ? 'msg-out' : 'msg-in',
                              mi === 0 && (mine ? 'rounded-tr-[3px]' : 'rounded-tl-[3px]'),
                            )}
                          >
                            {/* Barre d'actions : ancree au coin haut de la bulle, chevauche
                                legerement pour qu'il n'y ait aucun "trou" de survol. */}
                            {!isEditing && (
                              <div
                                className={clsx(
                                  'absolute bottom-full z-20 mb-[-6px] hidden items-center gap-0.5 rounded-full border border-[var(--outline)] bg-[var(--surface)] px-1 py-0.5 text-[var(--text)] shadow-elevation-2 group-hover/msg:flex',
                                  mine ? 'right-0' : 'left-0',
                                )}
                              >
                                {!mine && (
                                  <button
                                    className="icon-btn-sm"
                                    title="Repondre"
                                    onClick={() => {
                                      setReplyTo(m);
                                      taRef.current?.focus();
                                    }}
                                  >
                                    <IconReply className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  className="icon-btn-sm"
                                  title="Partager dans un autre canal"
                                  onClick={() => setSharing(m)}
                                >
                                  <IconShare className="h-4 w-4" />
                                </button>
                                {mine && (
                                  <button
                                    className="icon-btn-sm"
                                    title="Modifier"
                                    onClick={() => setEditing({ id: m.id, body: m.body })}
                                  >
                                    <IconEdit className="h-4 w-4" />
                                  </button>
                                )}
                                {mine && (
                                  <button
                                    className="icon-btn-sm text-red-500"
                                    title="Supprimer"
                                    onClick={() => deleteMessage(m)}
                                  >
                                    <IconDelete className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Nom de l'auteur (salon / groupe, premier message) */}
                            {!mine && groupish && mi === 0 && (
                              <button
                                onClick={() => openProfile(g.author.id)}
                                className="mb-0.5 block max-w-full truncate text-[13px] font-semibold leading-tight hover:underline"
                                style={{ color: avColor(g.author.id) }}
                              >
                                {g.author.fullName}
                              </button>
                            )}

                            {/* Message transfere */}
                            {m.forwardedFrom && (
                              <div className="mb-0.5 flex items-center gap-1 text-[11px] italic opacity-60">
                                <IconShare className="h-3 w-3" />
                                Transfere{m.forwardedFrom !== g.author.fullName ? ` · de ${m.forwardedFrom}` : ''}
                              </div>
                            )}

                            {/* Message cite */}
                            {m.parent && (
                              <div className="mb-1 rounded-[5px] border-l-[3px] border-[var(--accent)] bg-black/[0.05] py-1 pl-2 pr-2 text-[12.5px] leading-tight dark:bg-white/10">
                                <span
                                  className="block font-semibold"
                                  style={{ color: avColor(m.parent.author.id) }}
                                >
                                  {m.parent.author.fullName}
                                </span>
                                <span className="line-clamp-1 opacity-70">
                                  {m.parent.body || 'piece jointe'}
                                </span>
                              </div>
                            )}

                            {isEditing ? (
                              <div className="space-y-1.5 py-1">
                                <textarea
                                  autoFocus
                                  className="input text-sm"
                                  rows={2}
                                  value={editing!.body}
                                  onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      saveEdit();
                                    }
                                    if (e.key === 'Escape') setEditing(null);
                                  }}
                                />
                                <div className="flex gap-1.5">
                                  <button className="btn-primary btn-sm" onClick={saveEdit}>
                                    Enregistrer
                                  </button>
                                  <button className="btn-text btn-sm" onClick={() => setEditing(null)}>
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              m.body && (
                                <span className="text-[14px] leading-[19px]">
                                  {renderBody(m.body)}
                                  {m.editedAt && (
                                    <span className="ml-1 text-[11px] opacity-60">(modifie)</span>
                                  )}
                                  {/* Reserve la place de l'heure sur la derniere ligne (comme WhatsApp) */}
                                  <span
                                    className={clsx('inline-block', mine && receiptsOn ? 'w-[64px]' : 'w-[46px]')}
                                    aria-hidden="true"
                                  />
                                </span>
                              )
                            )}

                            {!!m.attachments?.length && (
                              <MessageAttachments atts={m.attachments} />
                            )}

                            {!isEditing && (
                              <span
                                className="msg-time"
                                title={new Date(m.createdAt).toLocaleString('fr-FR')}
                              >
                                {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {mine &&
                                  receiptsOn &&
                                  (isReadByAll(m) ? (
                                    <IconDoneAll className="text-sky-500" title="Lu" />
                                  ) : (
                                    <IconDone className="opacity-70" title="Envoye" />
                                  ))}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="relative border-t border-[var(--outline)] bg-[var(--bg)] px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          {/* Suggestions de mention */}
          {mention && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 max-h-52 overflow-y-auto rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-1 shadow-elevation-3 sm:left-4 sm:right-4">
              {mentionCandidates.map((u) => (
                <button
                  key={u.id}
                  onClick={() => insertMention(u.fullName)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                >
                  <Avatar id={u.id} name={u.fullName} src={u.avatarUrl} size={22} />
                  <span className="min-w-0 flex-1 truncate">{u.fullName}</span>
                  <span className="text-2xs text-[var(--text-dim)]">
                    @{u.fullName.split(/\s+/)[0]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {replyTo && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs">
              <IconReply className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              <span className="min-w-0 flex-1 truncate">
                Reponse a <span className="font-semibold">{replyTo.author.fullName}</span> :{' '}
                <span className="text-[var(--text-dim)]">{replyTo.body || 'piece jointe'}</span>
              </span>
              <button
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-[var(--text-dim)] hover:text-[var(--text)]"
                onClick={() => setReplyTo(null)}
                title="Annuler"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {uploadError && <div className="mb-1.5 px-1 text-xs text-red-600">{uploadError}</div>}
          {(pending.length > 0 || uploading) && (
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {pending.map((a, i) =>
                a.mimeType.startsWith('image/') ? (
                  <span key={i} className="group/att relative">
                    <img
                      src={a.url}
                      alt={a.name}
                      className="h-16 w-16 rounded-lg border border-[var(--outline)] object-cover"
                    />
                    <button
                      type="button"
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-dim)] shadow-elevation-1 transition hover:text-red-500"
                      onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                      title="Retirer"
                    >
                      <IconClose className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--outline)] bg-[var(--surface)] py-1 pl-2 pr-1 text-xs"
                  >
                    <IconFile className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                    <span className="max-w-[160px] truncate">{a.name}</span>
                    <span className="text-2xs text-[var(--text-dim)]">{fmtSize(a.size)}</span>
                    <button
                      type="button"
                      className="grid h-5 w-5 place-items-center rounded text-[var(--text-dim)] hover:text-red-500"
                      onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                      title="Retirer"
                    >
                      <IconClose className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ),
              )}
              {uploading && <span className="text-xs text-[var(--text-dim)]">Envoi du fichier…</span>}
            </div>
          )}
          <div className="flex items-end gap-1.5 rounded-[24px] border border-[var(--outline)] bg-[var(--surface)] p-1.5 shadow-elevation-1 transition-shadow focus-within:border-[var(--accent-soft)] focus-within:shadow-elevation-2 focus-within:ring-2 focus-within:ring-[var(--accent-ring)]">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
            <button
              type="button"
              className="icon-btn shrink-0"
              title="Joindre un fichier (2 Mo max)"
              disabled={uploading || !activeId}
              onClick={() => fileRef.current?.click()}
            >
              <IconAttach className="h-5 w-5" />
            </button>
            <textarea
              ref={taRef}
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-1 py-1.5 text-base outline-none placeholder:text-[var(--text-dim)]"
              placeholder={`Message ${activeChannel ? '#' + channelTitle(activeChannel) : ''}`}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onKeyDown={onComposerKey}
            />
            <button
              onClick={send}
              disabled={(!draft.trim() && pending.length === 0) || uploading}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-sm transition hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
              title="Envoyer"
            >
              <IconSend className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-2">
      <span className="text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <button onClick={onAdd} className="icon-btn-sm" aria-label={`Ajouter ${label}`}>
        <IconAdd className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConvItem({
  active,
  onClick,
  icon,
  label,
  call,
  unread = 0,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  call?: ActiveCall;
  unread?: number;
}) {
  const hasUnread = unread > 0 && !active;
  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-base transition',
          active
            ? 'accent-active font-semibold'
            : hasUnread
              ? 'font-semibold text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
              : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate item-title">{label}</span>
        {hasUnread && (
          <span className="ml-auto grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[var(--accent)] px-1.5 text-2xs font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {call && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-2xs font-semibold text-brand-700 dark:text-brand-300"
            title={`${call.type === 'VIDEO' ? 'Visio' : 'Appel'} en cours · ${call.participants} participant(s)`}
          >
            {call.type === 'VIDEO' ? (
              <IconVideoFill className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <IconCallFill className="h-3.5 w-3.5 animate-pulse" />
            )}
            {call.participants}
          </span>
        )}
      </button>
    </li>
  );
}

function ShareModal({
  message,
  channels,
  currentUserId,
  onClose,
  onShared,
}: {
  message: Message | null;
  channels: Channel[];
  currentUserId?: string;
  onClose: () => void;
  onShared: () => void;
}) {
  const [q, setQ] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chanName = (c: Channel) =>
    c.type !== 'DIRECT'
      ? `# ${c.name ?? 'salon'}`
      : (c.members ?? [])
          .filter((m) => m.userId !== currentUserId)
          .map((m) => m.user.fullName.split(' ')[0])
          .join(', ') || 'Message direct';

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return channels
      .filter((c) => c.id !== message?.channelId)
      .filter((c) => !s || chanName(c).toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, q, message]);

  async function shareTo(c: Channel) {
    if (!message || busy) return;
    setBusy(true);
    try {
      await api.post('/messages', {
        channelId: c.id,
        body: message.body,
        forwardedFrom: message.forwardedFrom || message.author.fullName,
        attachments: (message.attachments ?? []).map(({ url, name, mimeType, size }) => ({
          url,
          name,
          mimeType,
          size,
        })),
      });
      setSentTo(c.id);
      onShared();
      setTimeout(() => {
        setSentTo(null);
        onClose();
      }, 700);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!message} onClose={onClose} title="Partager le message">
      <div className="mb-3 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2 text-sm">
        <span className="font-semibold" style={{ color: avColor(message?.author.id ?? '') }}>
          {message?.author.fullName}
        </span>
        <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[var(--text-dim)]">
          {message?.body || 'piece jointe'}
        </p>
      </div>
      <div className="relative mb-2">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          autoFocus
          className="input pl-9"
          placeholder="Rechercher un canal…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <button
              disabled={busy}
              onClick={() => shareTo(c)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {c.type !== 'DIRECT' ? (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
                  style={{ background: c.color ?? avColor(c.id) }}
                >
                  <IconHash className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
                  <IconGroups className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{chanName(c)}</span>
              {sentTo === c.id ? (
                <IconTick className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              ) : (
                <IconShare className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              )}
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-3 text-center text-sm text-[var(--text-dim)]">Aucun canal</li>
        )}
      </ul>
    </Modal>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const isImage = (a: Attachment) => a.mimeType.startsWith('image/');

/** Pièces jointes d'un message : galerie d'images (grille + visionneuse) + fichiers. */
function MessageAttachments({ atts }: { atts: Attachment[] }) {
  const viewer = useImageViewer();
  const images = atts.filter(isImage);
  const files = atts.filter((a) => !isImage(a));
  const gallery = images.map((a) => ({ url: a.url, name: a.name }));

  return (
    <div className="mt-1 space-y-1.5">
      {images.length > 0 && (
        <ImageGallery images={images} onOpen={(i) => viewer.open(gallery, i)} />
      )}
      {files.map((a) => (
        <FileChip key={a.id} a={a} />
      ))}
    </div>
  );
}

/** Grille type Messenger : 1 = grande, 2 = côte à côte, 3 = 1 + 2, 4+ = 2×2 avec « +N ». */
function ImageGallery({
  images,
  onOpen,
}: {
  images: Attachment[];
  onOpen: (i: number) => void;
}) {
  const n = images.length;
  const shown = images.slice(0, 4);
  const imgCls = 'h-full w-full cursor-zoom-in object-cover transition hover:brightness-95';

  if (n === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="block max-w-[320px] overflow-hidden rounded-xl border border-[var(--outline)]"
      >
        <img
          src={images[0].url}
          alt={images[0].name}
          className="max-h-72 w-full cursor-zoom-in object-cover"
        />
      </button>
    );
  }

  return (
    <div
      className={clsx(
        'grid max-w-[320px] gap-1 overflow-hidden rounded-xl border border-[var(--outline)]',
        n === 2 ? 'aspect-[2/1] grid-cols-2' : 'aspect-square grid-cols-2 grid-rows-2',
      )}
    >
      {shown.map((a, i) => (
        <button
          type="button"
          key={a.id}
          onClick={() => onOpen(i)}
          className={clsx('relative block h-full w-full overflow-hidden', n === 3 && i === 0 && 'row-span-2')}
        >
          <img src={a.url} alt={a.name} className={imgCls} />
          {i === 3 && n > 4 && (
            <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-bold text-white">
              +{n - 4}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function FileChip({ a }: { a: Attachment }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.name}
      className="flex max-w-[280px] items-center gap-2 rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:bg-[var(--surface-2)]"
    >
      <IconFile className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{a.name}</span>
        <span className="block text-2xs text-[var(--text-dim)]">{fmtSize(a.size)}</span>
      </span>
      <IconDownload className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
    </a>
  );
}

function fmtDuration(from: string, to: string) {
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min` : `${s} s`;
}

function CallEvent({
  m,
  mine,
  live,
  onJoin,
}: {
  m: Message;
  mine: boolean;
  live: boolean;
  onJoin: () => void;
}) {
  const c = m.call;
  const isVideo = c?.type === 'VIDEO';
  const missed = c?.status === 'MISSED';
  const label = live
    ? isVideo
      ? 'Visio en cours'
      : 'Appel en cours'
    : missed
      ? isVideo
        ? 'Visio manquée'
        : 'Appel manqué'
      : isVideo
        ? 'Visio terminée'
        : 'Appel terminé';
  const dur = c && !live && !missed && c.endedAt ? ` · ${fmtDuration(c.startedAt, c.endedAt)}` : '';
  const time = new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-center">
      <div
        className={clsx(
          'flex max-w-full flex-wrap items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-sm',
          live
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : missed
              ? 'border-red-300 text-red-600 dark:border-red-500/40'
              : 'border-[var(--outline)] bg-[var(--surface)]',
        )}
      >
        <span
          className={clsx(
            'grid h-7 w-7 shrink-0 place-items-center rounded-full',
            live
              ? 'bg-[var(--accent)] text-white'
              : missed
                ? 'bg-red-100 text-red-600 dark:bg-red-500/15'
                : 'bg-[var(--surface-2)] text-[var(--text-dim)]',
          )}
        >
          {isVideo ? <IconVideo className="h-4 w-4" /> : <IconCall className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="font-medium">{label}</span>
          {dur}
          <span className="ml-1.5 text-2xs text-[var(--text-dim)]">
            {mine ? 'Vous' : m.author.fullName} · {time}
          </span>
        </span>
        {live && (
          <button onClick={onJoin} className="btn-primary btn-sm ml-1 shrink-0">
            {isVideo ? <IconVideo className="h-4 w-4" /> : <IconCall className="h-4 w-4" />} Rejoindre
          </button>
        )}
      </div>
    </div>
  );
}

function groupMessages(msgs: Message[]) {
  const groups: { author: Message['author']; items: Message[] }[] = [];
  for (const m of msgs) {
    const last = groups[groups.length - 1];
    const prev = last?.items[last.items.length - 1];
    if (
      last &&
      m.kind !== 'CALL' &&
      prev?.kind !== 'CALL' &&
      last.author.id === m.author.id &&
      prev &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000
    ) {
      last.items.push(m);
    } else {
      groups.push({ author: m.author, items: [m] });
    }
  }
  return groups;
}
