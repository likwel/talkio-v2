import { DragEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Board, Card } from '@/lib/types';
import { IconComment, IconBack, IconAdd } from '@/lib/icons';

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function BoardDetail() {
  const { boardId } = useParams();
  const qc = useQueryClient();
  const [newColumn, setNewColumn] = useState('');
  const [drag, setDrag] = useState<{ cardId: string; fromColumn: string } | null>(null);

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

  if (board.isLoading) return <div className="p-6 text-slate-400">Chargement…</div>;
  if (!board.data) return <div className="p-6">Tableau introuvable</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--outline)] px-4 py-2.5">
        <Link to="/boards" className="icon-btn" aria-label="Retour aux tableaux">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-[20px] font-normal text-slate-700 dark:text-slate-200">{board.data.name}</h1>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {board.data.columns?.map((col) => (
          <div
            key={col.id}
            className="flex w-72 shrink-0 flex-col rounded-2xl bg-[var(--surface-2)] p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.id, col.cards.length)}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{col.name}</span>
              <span className="text-xs text-slate-500">{col.cards.length}</span>
            </div>

            <div className="flex-1 space-y-2">
              {col.cards.map((card, idx) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onDragStart={() => setDrag({ cardId: card.id, fromColumn: col.id })}
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
    </div>
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
      {card.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{card.description}</p>}
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[card.priority]}`}>
          {card.priority}
        </span>
        {card.dueDate && (
          <span className="text-[10px] text-slate-400">{new Date(card.dueDate).toLocaleDateString()}</span>
        )}
        {!!card._count?.comments && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <IconComment className="h-3.5 w-3.5" /> {card._count.comments}
          </span>
        )}
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
        className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5"
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
