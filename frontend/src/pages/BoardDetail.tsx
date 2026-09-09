import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Modal from '@/components/Modal';
import Select from '@/components/Select';
import Pagination, { usePagination } from '@/components/Pagination';
import { useProfile } from '@/context/ProfileContext';
import { useDialog } from '@/context/DialogContext';
import type { Board, BoardStatus, Card, User, WorkspaceDetail } from '@/lib/types';
import { STATUS_LABEL, ProgressBar } from '@/pages/Boards';
import Avatar from '@/components/Avatar';
import BoardSettingsModal from '@/components/BoardSettingsModal';
import {
  IconComment,
  IconBack,
  IconAdd,
  IconSettings,
  IconKanban,
  IconForms,
  IconClose,
  IconDelete,
} from '@/lib/icons';

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-[var(--surface-2)] text-[var(--text-dim)]',
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
  const [openCard, setOpenCard] = useState<Card | null>(null);

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
  const cardsPg = usePagination(allCards, 25, `${boardId}|${view}`);

  if (board.isLoading) return <div className="p-6 text-[var(--text-dim)]">Chargement…</div>;
  if (!board.data) return <div className="p-6">Projet introuvable</div>;
  const b = board.data;

  return (
    <div className="flex h-full flex-col">
      {/* --- En-tete projet --- */}
      <div className="space-y-2 border-b border-[var(--outline)] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/projects" className="icon-btn shrink-0" aria-label="Retour">
            <IconBack className="h-5 w-5" />
          </Link>
          {b.color && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color }} />}
          <h1 className="min-w-0 flex-1 truncate text-md font-bold sm:flex-none sm:text-lg">{b.name}</h1>
          <Select
            className="h-9 w-36 shrink-0"
            aria-label="Statut du projet"
            value={b.status}
            onChange={(v) => setStatus(v as BoardStatus)}
            options={(Object.keys(STATUS_LABEL) as BoardStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />

          <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
            <div className="flex rounded-lg border border-[var(--outline)] p-0.5">
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
            <button className="icon-btn ml-auto sm:ml-0" title="Paramètres du projet" onClick={() => setSettingsOpen(true)}>
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
              <Avatar id={b.lead.id} name={b.lead.fullName} src={b.lead.avatarUrl} size={20} />
              Chef de projet : {b.lead.fullName}
            </span>
          )}
          {b.members && b.members.length > 0 && (
            <span className="flex items-center">
              <span className="mr-1">Équipe :</span>
              <span className="flex -space-x-1.5">
                {b.members.slice(0, 6).map((m) => (
                  <span key={m.user.id} title={m.user.fullName} className="rounded-full ring-2 ring-[var(--surface)]">
                    <Avatar id={m.user.id} name={m.user.fullName} src={m.user.avatarUrl} size={20} />
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
                    onOpen={() => setOpenCard(card)}
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
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--text-dim)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Tâche</th>
                  <th className="px-3 py-2 font-semibold">Colonne</th>
                  <th className="px-3 py-2 font-semibold">Priorité</th>
                  <th className="px-3 py-2 font-semibold">Échéance</th>
                  <th className="px-3 py-2 font-semibold">Assigné·es</th>
                </tr>
              </thead>
              <tbody>
                {cardsPg.slice.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setOpenCard(c)}
                    className="group cursor-pointer border-t border-[var(--outline)] transition hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-3 py-2 font-medium item-title">{c.title}</td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">{c.columnName}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('rounded-md px-1.5 py-0.5 text-2xs font-semibold', PRIORITY_STYLE[c.priority])}>
                        {PRIORITY_LABEL[c.priority]}
                      </span>
                    </td>
                    <td className={clsx('px-3 py-2', isOverdue(c.dueDate) && 'font-semibold text-red-600')}>
                      {c.dueDate ? new Date(c.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex -space-x-1.5">
                        {(c.assignees ?? []).map((a) => (
                          <span key={a.user.id} title={a.user.fullName} className="rounded-full ring-2 ring-[var(--surface)]">
                            <Avatar id={a.user.id} name={a.user.fullName} src={a.user.avatarUrl} size={24} />
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
                {allCards.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--text-dim)]">
                      Aucune tâche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={cardsPg.page}
            pageCount={cardsPg.pageCount}
            onChange={cardsPg.setPage}
            total={cardsPg.total}
            start={cardsPg.start}
            end={cardsPg.end}
          />
        </div>
      )}

      <BoardSettingsModal board={b} open={settingsOpen} onClose={() => setSettingsOpen(false)} onChanged={() => board.refetch()} />
      <CardModal
        workspaceId={b.workspaceId}
        card={openCard}
        boardMembers={b.members ?? []}
        onClose={() => setOpenCard(null)}
        onChanged={() => board.refetch()}
      />
    </div>
  );
}

function CardItem({
  card,
  onOpen,
  onDragStart,
  onDrop,
}: {
  card: Card;
  onOpen: () => void;
  onDragStart: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onOpen}
      className="group cursor-pointer rounded-xl bg-[var(--surface)] p-3 text-sm shadow-elevation-1 transition hover:shadow-elevation-2 active:cursor-grabbing"
    >
      <div className="font-medium item-title">{card.title}</div>
      {card.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">{card.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={clsx('rounded-md px-1.5 py-0.5 text-2xs font-semibold', PRIORITY_STYLE[card.priority])}>
          {PRIORITY_LABEL[card.priority]}
        </span>
        {card.dueDate && (
          <span className={clsx('text-2xs', isOverdue(card.dueDate) ? 'font-semibold text-red-600' : 'text-[var(--text-dim)]')}>
            {new Date(card.dueDate).toLocaleDateString('fr-FR')}
          </span>
        )}
        {!!card._count?.comments && (
          <span className="flex items-center gap-0.5 text-2xs text-[var(--text-dim)]">
            <IconComment className="h-3.5 w-3.5" /> {card._count.comments}
          </span>
        )}
        <span className="ml-auto flex -space-x-1.5">
          {(card.assignees ?? []).slice(0, 3).map((a) => (
            <span key={a.user.id} title={a.user.fullName} className="rounded-full ring-2 ring-[var(--surface)]">
              <Avatar id={a.user.id} name={a.user.fullName} src={a.user.avatarUrl} size={20} />
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
      <button onClick={() => setOpen(true)} className="btn-text btn-sm mt-2 w-full justify-start">
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
        placeholder="Titre de la tâche"
      />
      <div className="mt-2 flex gap-1">
        <button className="btn-primary btn-sm">Ajouter</button>
        <button type="button" className="btn-text btn-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Fiche d'une tâche : titre, description, priorité, échéance et assignation de personnes. */
function CardModal({
  card,
  boardMembers,
  workspaceId,
  onClose,
  onChanged,
}: {
  card: Card | null;
  boardMembers: { user: Pick<User, 'id' | 'fullName' | 'avatarUrl'> }[];
  workspaceId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { openProfile } = useProfile();
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Card['priority']>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<NonNullable<Card['assignees']>>([]);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? '');
    setPriority(card.priority);
    setDueDate(card.dueDate ? card.dueDate.slice(0, 10) : '');
    setAssignees(card.assignees ?? []);
    setPickerOpen(false);
    setQ('');
  }, [card]);

  const ws = useQuery({
    queryKey: ['workspace', workspaceId],
    enabled: !!card && !!workspaceId,
    queryFn: async () => (await api.get<WorkspaceDetail>(`/workspaces/${workspaceId}`)).data,
  });

  const people = (ws.data?.members.map((m) => m.user) ?? boardMembers.map((m) => m.user)) as Pick<
    User,
    'id' | 'fullName' | 'avatarUrl'
  >[];
  const assignedIds = new Set(assignees.map((a) => a.user.id));

  async function toggleAssignee(u: Pick<User, 'id' | 'fullName' | 'avatarUrl'>) {
    if (!card) return;
    if (assignedIds.has(u.id)) {
      setAssignees((a) => a.filter((x) => x.user.id !== u.id));
      await api.delete(`/boards/cards/${card.id}/assignees/${u.id}`);
    } else {
      setAssignees((a) => [...a, { user: u }]);
      await api.post(`/boards/cards/${card.id}/assignees`, { userId: u.id });
    }
    onChanged();
  }

  async function save() {
    if (!card) return;
    setSaving(true);
    try {
      await api.patch(`/boards/cards/${card.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
      });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function removeCard() {
    if (!card) return;
    const ok = await dialog.confirm({
      title: 'Supprimer la tâche',
      message: `« ${card.title} » sera definitivement supprimee.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/boards/cards/${card.id}`);
    onChanged();
    onClose();
  }

  const filtered = people.filter(
    (u) => !assignedIds.has(u.id) && u.fullName.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <Modal
      open={!!card}
      onClose={onClose}
      title="Tâche"
      footer={
        <>
          <button className="btn-text btn-sm mr-auto text-red-600 hover:text-red-700" onClick={removeCard}>
            <IconDelete className="h-4 w-4" /> Supprimer
          </button>
          <button className="btn-text" onClick={onClose}>
            Fermer
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !title.trim()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="field-label">Titre</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">Description</span>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Priorité</span>
            <Select
              value={priority}
              onChange={(v) => setPriority(v as Card['priority'])}
              options={(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => ({
                value: p,
                label: PRIORITY_LABEL[p],
              }))}
            />
          </label>
          <label className="block">
            <span className="field-label">Échéance</span>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">Assigné·es ({assignees.length})</span>
            <button className="btn-text btn-sm" onClick={() => setPickerOpen((v) => !v)}>
              <IconAdd className="h-4 w-4" /> Assigner
            </button>
          </div>

          {assignees.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {assignees.map((a) => (
                <li
                  key={a.user.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--outline)] py-1 pl-1 pr-1.5 text-sm"
                >
                  <button
                    onClick={() => openProfile(a.user.id)}
                    className="flex items-center gap-1.5"
                    title="Voir le profil"
                  >
                    <Avatar id={a.user.id} name={a.user.fullName} src={a.user.avatarUrl} size={24} />
                    <span className="max-w-[140px] truncate">{a.user.fullName}</span>
                  </button>
                  <button
                    className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-dim)] hover:text-red-500"
                    onClick={() => toggleAssignee(a.user)}
                    title="Retirer"
                  >
                    <IconClose className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-xs text-[var(--text-dim)]">Personne n'est assigné à cette tâche.</p>
          )}

          {pickerOpen && (
            <div className="rounded-lg border border-[var(--outline)]">
              <div className="relative border-b border-[var(--outline)] p-1.5">
                <input
                  autoFocus
                  className="h-8 w-full rounded-md bg-[var(--surface-2)] px-2.5 text-sm outline-none placeholder:text-[var(--text-dim)]"
                  placeholder="Rechercher une personne…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => toggleAssignee(u)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
                  >
                    <Avatar id={u.id} name={u.fullName} src={u.avatarUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate">{u.fullName}</span>
                    <IconAdd className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="p-2 text-xs text-[var(--text-dim)]">Aucune personne à ajouter</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
