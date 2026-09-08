import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import type { ActiveCall, Channel, Message } from '@/lib/types';
import {
  IconAdd,
  IconCall,
  IconVideo,
  IconSearch,
  IconSend,
  IconHash,
  IconAt,
  IconGroups,
  IconCallFill,
  IconVideoFill,
  IconFriends,
  IconBack,
} from '@/lib/icons';
import NewConversationModal from '@/components/NewConversationModal';
import FriendsModal from '@/components/FriendsModal';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

const AV_COLORS = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
function avColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

function Avatar({ id, name, size = 36 }: { id: string; name?: string | null; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: avColor(id), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
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
  const [newChannel, setNewChannel] = useState('');
  // Mobile : on affiche soit la liste, soit la conversation
  const [mobileView, setMobileView] = useState<'list' | 'thread'>(channelId ? 'thread' : 'list');
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMobileView(channelId ? 'thread' : 'list');
  }, [channelId]);

  const channels = useQuery({
    queryKey: ['channels', current?.id],
    enabled: !!current,
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
    const onChange = () => qc.invalidateQueries({ queryKey: ['activeCalls'] });
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
      }
    };
    socket.on('message:new', onNew);
    return () => {
      socket.emit('channel:unsubscribe', activeId);
      socket.off('message:new', onNew);
    };
  }, [activeId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [draft]);

  async function send() {
    if (!draft.trim() || !activeId) return;
    const body = draft.trim();
    setDraft('');
    await api.post('/messages', { channelId: activeId, body });
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
      const r = await api.post<Channel>('/channels/direct', { workspaceId: current.id, userIds: [userId] });
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

  const headerCall = activeId ? callByChannel.get(activeId) : undefined;

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
            <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold">
              {current?.name ?? 'Talkio'}
            </span>
            <button className="icon-btn-sm" title="Amis" onClick={() => setFriendsOpen(true)}>
              <IconFriends className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              className="input h-9 pl-8 text-[13px]"
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
                className="input h-8 text-[13px]"
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
                icon={<IconHash className="h-4 w-4 opacity-70" />}
                label={c.name ?? 'salon'}
                call={callByChannel.get(c.id)}
              />
            ))}
            {filtSalons.length === 0 && <li className="px-3 py-1 text-xs text-[var(--text-dim)]">Aucun salon</li>}
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
                      <Avatar id={p?.id ?? c.id} name={p?.fullName} size={20} />
                    )
                  }
                  label={channelTitle(c)}
                  call={callByChannel.get(c.id)}
                />
              );
            })}
            {filtDms.length === 0 && (
              <li className="px-3 py-1 text-xs text-[var(--text-dim)]">Aucune conversation</li>
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
          {activeChannel?.type !== 'DIRECT' ? (
            <IconHash className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
          ) : isGroup(activeChannel) ? (
            <IconGroups className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
          ) : (
            <IconAt className="h-5 w-5 shrink-0 text-[var(--text-dim)]" />
          )}
          <span className="truncate font-display text-[15px] font-bold">{channelTitle(activeChannel)}</span>
          {activeChannel?.topic && (
            <>
              <span className="hidden h-4 w-px bg-[var(--outline)] sm:block" />
              <span className="hidden truncate text-[13px] text-[var(--text-dim)] sm:block">
                {activeChannel.topic}
              </span>
            </>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button className="icon-btn" title="Appel audio" onClick={() => startCall('AUDIO')}>
              <IconCall className="h-5 w-5" />
            </button>
            <button className="icon-btn" title="Visio" onClick={() => startCall('VIDEO')}>
              <IconVideo className="h-5 w-5" />
            </button>
            <button className="hidden icon-btn sm:grid" title="Membres">
              <IconGroups className="h-5 w-5" />
            </button>
          </div>
        </div>

        {headerCall && (
          <button
            onClick={() => navigate(`/call/${headerCall.roomId}`)}
            className="flex items-center gap-2 border-b border-[var(--outline)] bg-brand-500/10 px-4 py-2 text-left text-[13px] font-semibold text-brand-700 transition hover:bg-brand-500/15 dark:text-brand-300"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
            </span>
            {headerCall.type === 'VIDEO' ? 'Visio en cours' : 'Appel en cours'} · {headerCall.participants} participant(s)
            <span className="ml-auto rounded-full bg-[var(--accent)] px-3 py-1 text-white">Rejoindre</span>
          </button>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
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
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <div key={gi} className="flex gap-3">
                <Avatar id={g.author.id} name={g.author.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold">{g.author.fullName}</span>
                    <span className="text-[11px] text-[var(--text-dim)]">
                      {new Date(g.items[0].createdAt).toLocaleString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  {g.items.map((m) => (
                    <p key={m.id} className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                      {m.body}
                      {m.editedAt && <span className="ml-1 text-[10px] text-[var(--text-dim)]">(modifie)</span>}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-2 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-brand-500/15">
            <textarea
              ref={taRef}
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-[var(--text-dim)]"
              placeholder={`Message ${activeChannel ? '#' + channelTitle(activeChannel) : ''}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKey}
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white transition hover:brightness-110 disabled:opacity-30"
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
      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  call?: ActiveCall;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition',
          active
            ? 'bg-brand-500/12 font-semibold text-brand-700 dark:text-brand-300'
            : 'text-[var(--text-dim)] hover:bg-black/5 hover:text-[var(--text)] dark:hover:bg-white/5',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {call && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300"
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

function groupMessages(msgs: Message[]) {
  const groups: { author: Message['author']; items: Message[] }[] = [];
  for (const m of msgs) {
    const last = groups[groups.length - 1];
    const prev = last?.items[last.items.length - 1];
    if (
      last &&
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
