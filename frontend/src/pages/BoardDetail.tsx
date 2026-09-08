import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Modal from '@/components/Modal';
import ColorPicker from '@/components/ColorPicker';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProfile } from '@/context/ProfileContext';
import type { Board, BoardStatus, Card, WorkspaceDetail } from '@/lib/types';
import { STATUS_LABEL, ProgressBar, tint, initials } from '@/pages/Boards';
import { IconComment, IconBack, IconAdd, IconSettings, IconKanban, IconForms, IconClose } from '@/lib/icons';

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
const isOverdue = (d?: string | null) => !!d && new Date(d) < new Date(new Date().toDateString());

export default function BoardDetail() {
  const { boardId } = useParams();
  const qc = useQueryClient();
  const [newColumn, setNewColumn] = useState('');
  const [drag, setDrag] = useState<{ cardId: string } | null>(null);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const board = useQuery({
    queryKey: ['board', boardId],
    enabled: !!boardId,
    queryFn: async () => (await api.get<Board>(`/boards/${boardId}`)).data,
  });

  useEffect(() => {
    if (!boardId) return;
    const socket = getSocket();
    socket.emit('board:subscribe', boardId);
    const onChange = () => qc.invalidateQueries({ queryKey: ['board', boardId] });
    socket.on('board:changed', onChange);
    return () => {
      socket.emit('board:unsubscribe', boardId);
      socket.off('board:changed', onChange);
    };
  }, [boardId, qc]);

  async function setStatus(status: BoardStatus) {
    await api.patch(`/boards/${boardId}`, { status });
    board.refetch();
  }
  async function addColumn(e: FormEvent) {
    e.preventDefault();
    if (!newColumn.trim()) return;
    await api.post(`/boards/${boardId}/columns`, { name: newColumn });
    setNewColumn('');
    board.refetch();
  }
  async function addCard(columnId: string, title: string) {
    if (!title.trim()) return;
    await api.post(`/boards/columns/${columnId}/cards`, { title });
    board.refetch();
  }
  async function onDrop(e: DragEvent, toColumnId: string, toPosition: number) {
    e.preventDefault();
    if (!drag) return;
    setDrag(null);
    await api.post(`/boards/cards/${drag.cardId}/move`, { toColumnId, toPosition });
    board.refetch();
  }

  const allCards = useMemo(
    () =>
      (board.data?.columns ?? []).flatMap((c) => c.cards.map((card) => ({ ...card, columnName: c.name }))),
    [board.data],
  );

  if (board.isLoading) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;
  if (!board.data) return <div className="p-6">Projet introuvable</div>;
  const b = board.data;

  return (
    <div className="flex h-full flex-col">
      {/* --- En-tete projet --- */}
      <div className="space-y-2 border-b border-[var(--outline)] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/projects" className="icon-btn" aria-label="Retour">
            <IconBack className="h-5 w-5" />
          </Link>
          {b.color && <span className="h-3 w-3 rounded-full" style={{ background: b.color }} />}
          <h1 className="text-base font-semibold sm:text-lg">{b.name}</h1>
          <select
            className="input h-8 w-32 text-xs"
            value={b.status}
            onChange={(e) => setStatus(e.target.value as BoardStatus)}
          >
            {(Object.keys(STATUS_LABEL) as BoardStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-1">
            <div className="mr-1 flex rounded-lg border border-[var(--outline)] p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={clsx('flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold', view === 'kanban' && 'accent-active')}
              >
                <IconKanban className="h-4 w-4" /> Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={clsx('flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold', view === 'list' && 'accent-active')}
              >
                <IconForms className="h-4 w-4" /> Liste
              </button>
            </div>
            <button className="icon-btn" title="Parametres du projet" onClick={() => setSettingsOpen(true)}>
              <IconSettings className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-dim)]">
          {b.progress && (
            <span className="flex min-w-[160px] items-center gap-2">
              <ProgressBar pct={b.progress.pct} />
              {b.progress.done}/{b.progress.total} · {b.progress.pct}%
            </span>
          )}
          {b.lead && (
            <span className="flex items-center gap-1">
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold text-white"
                style={{ background: tint(b.lead.id) }}
              >
                {initials(b.lead.fullName)}
              </span>
              Chef : {b.lead.fullName}
            </span>
          )}
          {b.members && b.members.length > 0 && (
            <span className="flex items-center">
              <span className="mr-1">Equipe :</span>
              <span className="flex -space-x-1.5">
                {b.members.slice(0, 6).map((m) => (
                  <span
                    key={m.user.id}
                    title={m.user.fullName}
                    className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold text-white ring-2 ring-[var(--surface)]"
                    style={{ background: tint(m.user.id) }}
                  >
                    {initials(m.user.fullName)}
                  </span>
                ))}
              </span>
            </span>
          )}
          {(b.startDate || b.endDate) && (
            <span>
              {b.startDate ? new Date(b.startDate).toLocaleDateString('fr-FR') : '…'} →{' '}
              {b.endDate ? new Date(b.endDate).toLocaleDateString('fr-FR') : '…'}
            </span>
          )}
        </div>
      </div>

      {/* --- Vue --- */}
      {view === 'kanban' ? (
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {b.columns?.map((col) => (
            <div
              key={col.id}
              className="flex w-72 shrink-0 flex-col rounded-2xl bg-[var(--surface-2)] p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, col.id, col.cards.length)}
            >
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-sm font-medium">{col.name}</span>
                <span className="text-xs text-[var(--text-dim)]">{col.cards.length}</span>
              </div>
              <div className="flex-1 space-y-2">
                {col.cards.map((card, idx) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    onDragStart={() => setDrag({ cardId: card.id })}
                    onDrop={(e) => onDrop(e, col.id, idx)}
                  />
                ))}
              </div>
              <AddCard onAdd={(t) => addCard(col.id, t)} />
            </div>
          ))}
          <form onSubmit={addColumn} className="w-72 shrink-0">
            <input
              className="input surface"
              placeholder="+ Ajouter une colonne"
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
            />
          </form>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-dim)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tache</th>
                  <th className="px-3 py-2 font-semibold">Colonne</th>
                  <th className="px-3 py-2 font-semibold">Priorite</th>
                  <th className="px-3 py-2 font-semibold">Echeance</th>
                  <th className="px-3 py-2 font-semibold">Assignes</th>
                </tr>
              </thead>
              <tbody>
                {allCards.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--outline)]">
                    <td className="px-3 py-2 font-medium">{c.title}</td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">{c.columnName}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', PRIORITY_STYLE[c.priority])}>
                        {c.priority}
                      </span>
                    </td>
                    <td className={clsx('px-3 py-2', isOverdue(c.dueDate) && 'font-semibold text-red-600')}>
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex -space-x-1.5">
                        {(c.assignees ?? []).map((a) => (
                          <span
                            key={a.user.id}
                            title={a.user.fullName}
                            className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-[var(--surface)]"
                            style={{ background: tint(a.user.id) }}
                          >
                            {initials(a.user.fullName)}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
                {allCards.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--text-dim)]">
                      Aucune tache.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BoardSettingsModal board={b} open={settingsOpen} onClose={() => setSettingsOpen(false)} onChanged={() => board.refetch()} />
    </div>
  );
}

function BoardSettingsModal({
  board,
  open,
  onClose,
  onChanged,
}: {
  board: Board;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { current } = useWorkspace();
  const { openProfile } = useProfile();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? '');
  const [color, setColor] = useState<string | null>(board.color ?? null);
  const [leadId, setLeadId] = useState(board.leadId ?? '');
  const [start, setStart] = useState(board.startDate?.slice(0, 10) ?? '');
  const [end, setEnd] = useState(board.endDate?.slice(0, 10) ?? '');

  useEffect(() => {
    if (open) {
      setName(board.name);
      setDescription(board.description ?? '');
      setColor(board.color ?? null);
      setLeadId(board.leadId ?? '');
      setStart(board.startDate?.slice(0, 10) ?? '');
      setEnd(board.endDate?.slice(0, 10) ?? '');
    }
  }, [open, board]);

  const wsDetail = useQuery({
    queryKey: ['workspace', current?.id],
    enabled: open && !!current,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${current!.id}`)).data,
  });
  const memberIds = new Set((board.members ?? []).map((m) => m.user.id));

  async function save() {
    await api.patch(`/boards/${board.id}`, {
      name: name.trim(),
      description: description.trim() || null,
      color,
      leadId: leadId || null,
      startDate: start || null,
      endDate: end || null,
    });
    onChanged();
    onClose();
  }
  async function addMember(uid: string) {
    await api.post(`/boards/${board.id}/members`, { userIds: [uid] });
    onChanged();
  }
  async function removeMember(uid: string) {
    await api.delete(`/boards/${board.id}/members/${uid}`);
    onChanged();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Parametres du projet"
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
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Nom</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Description</span>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Debut</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Echeance</span>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[var(--text-dim)]">Chef de projet</span>
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Aucun</option>
            {wsDetail.data?.members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.fullName}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-dim)]">Couleur</span>
          <ColorPicker value={color} onChange={setColor} allowNone />
        </div>

        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
            Equipe ({board.members?.length ?? 0})
          </div>
          <ul className="mb-2 space-y-0.5">
            {(board.members ?? []).map((m) => (
              <li key={m.user.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm">
                <button onClick={() => openProfile(m.user.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: tint(m.user.id) }}
                  >
                    {initials(m.user.fullName)}
                  </span>
                  <span className="truncate">{m.user.fullName}</span>
                </button>
                <button className="icon-btn-sm text-red-500" onClick={() => removeMember(m.user.id)} title="Retirer">
                  <IconClose className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--outline)]">
            {wsDetail.data?.members
              .filter((m) => !memberIds.has(m.user.id))
              .map((m) => (
                <button
                  key={m.user.id}
                  onClick={() => addMember(m.user.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--surface-2)]"
                >
                  <IconAdd className="h-4 w-4 text-[var(--text-dim)]" /> {m.user.fullName}
                </button>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CardItem({
  card,
  onDragStart,
  onDrop,
}: {
  card: Card;
  onDragStart: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="cursor-grab rounded-xl bg-[var(--surface)] p-3 text-sm shadow-elevation-1 transition hover:shadow-elevation-2 active:cursor-grabbing"
    >
      <div className="font-medium">{card.title}</div>
      {card.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">{card.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', PRIORITY_STYLE[card.priority])}>
          {card.priority}
        </span>
        {card.dueDate && (
          <span className={clsx('text-[10px]', isOverdue(card.dueDate) ? 'font-semibold text-red-600' : 'text-[var(--text-dim)]')}>
            {new Date(card.dueDate).toLocaleDateString('fr-FR')}
          </span>
        )}
        {!!card._count?.comments && (
          <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-dim)]">
            <IconComment className="h-3.5 w-3.5" /> {card._count.comments}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5">
          {(card.assignees ?? []).slice(0, 3).map((a) => (
            <span
              key={a.user.id}
              title={a.user.fullName}
              className="grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold text-white ring-2 ring-[var(--surface)]"
              style={{ background: tint(a.user.id) }}
            >
              {initials(a.user.fullName)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function AddCard({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-2 text-left text-sm text-[var(--text-dim)] transition hover:bg-black/5 dark:hover:bg-white/5"
      >
        <IconAdd className="h-4 w-4" /> Ajouter une carte
      </button>
    );
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(value);
        setValue('');
        setOpen(false);
      }}
    >
      <textarea
        autoFocus
        className="input surface text-sm"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Titre de la carte"
      />
      <div className="mt-2 flex gap-1">
        <button className="btn-primary h-8 px-4 text-xs">Ajouter</button>
        <button type="button" className="btn-text h-8 text-xs" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
