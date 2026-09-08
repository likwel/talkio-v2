import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Board, BoardStatus } from '@/lib/types';
import { IconAdd, IconKanban } from '@/lib/icons';

export const STATUS_LABEL: Record<BoardStatus, string> = {
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Termine',
  ARCHIVED: 'Archive',
};
export const STATUS_STYLE: Record<BoardStatus, string> = {
  ACTIVE: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  ON_HOLD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  ARCHIVED: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400',
};

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
export const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};
export const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('');

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Boards() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [filter, setFilter] = useState<'all' | BoardStatus>('all');

  const boards = useQuery({
    queryKey: ['boards', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Board[]>('/boards', { params: { workspaceId: current!.id } })).data,
  });

  const createBoard = useMutation({
    mutationFn: async () => (await api.post('/boards', { workspaceId: current!.id, name })).data,
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['boards', current?.id] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createBoard.mutate();
  }

  const shown = useMemo(
    () => (boards.data ?? []).filter((b) => filter === 'all' || b.status === filter),
    [boards.data, filter],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <h1 className="flex items-center gap-2 text-lg font-normal sm:text-[22px]">
        <IconKanban className="h-6 w-6 text-[var(--accent)]" /> Projets
      </h1>

      <form onSubmit={submit} className="flex max-w-md gap-2">
        <input className="input" placeholder="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={createBoard.isPending}>
          <IconAdd className="h-5 w-5" /> Creer
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'chip',
              filter === s ? 'border-[var(--accent)] accent-active' : 'text-[var(--text-dim)]',
            )}
          >
            {s === 'all' ? 'Tous' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => (
          <Link
            key={b.id}
            to={`/projects/${b.id}`}
            className="card space-y-3 transition hover:-translate-y-0.5 hover:shadow-elevation-2"
            style={b.color ? { borderTopColor: b.color, borderTopWidth: 3 } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[15px] font-semibold">{b.name}</div>
              <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[b.status])}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>
            {b.description && <p className="line-clamp-2 text-xs text-[var(--text-dim)]">{b.description}</p>}
            {b.progress && (
              <div className="space-y-1">
                <ProgressBar pct={b.progress.pct} />
                <div className="text-[11px] text-[var(--text-dim)]">
                  {b.progress.done}/{b.progress.total} taches · {b.progress.pct}%
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
              <span className="flex -space-x-1.5">
                {b.lead && (
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-[var(--surface)]"
                    style={{ background: tint(b.lead.id) }}
                    title={`Chef : ${b.lead.fullName}`}
                  >
                    {initials(b.lead.fullName)}
                  </span>
                )}
                {(b._count?.members ?? 0) > 0 && <span className="pl-2">{b._count?.members} membre(s)</span>}
              </span>
              {b.endDate && <span>Echeance {new Date(b.endDate).toLocaleDateString('fr-FR')}</span>}
            </div>
          </Link>
        ))}
        {shown.length === 0 && <p className="text-[var(--text-dim)]">Aucun projet.</p>}
      </div>
    </div>
  );
}
