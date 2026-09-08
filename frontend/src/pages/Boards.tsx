import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Board, BoardStatus } from '@/lib/types';
import { IconAdd, IconKanban, IconClose } from '@/lib/icons';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';

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
  ARCHIVED: 'bg-[var(--surface-2)] text-[var(--text-dim)]',
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
  const [view, setView] = useViewMode('boards');
  const [addOpen, setAddOpen] = useState(false);

  const boards = useQuery({
    queryKey: ['boards', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Board[]>('/boards', { params: { workspaceId: current!.id } })).data,
  });

  const createBoard = useMutation({
    mutationFn: async () => (await api.post('/boards', { workspaceId: current!.id, name })).data,
    onSuccess: () => {
      setName('');
      setAddOpen(false);
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

  const total = boards.data?.length ?? 0;
  const pg = usePagination(shown, 12, `${filter}|${view}`);

  return (
    <div className="page max-w-8xl space-y-5">
      {/* En-tete */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">
            <IconKanban className="h-6 w-6 text-[var(--accent)]" /> Projets
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            Suivez l'avancement de vos projets en Kanban ou en liste.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? <IconClose className="h-5 w-5" /> : <IconAdd className="h-5 w-5" />}
          {addOpen ? 'Fermer' : 'Nouveau projet'}
        </button>
      </div>

      {addOpen && (
        <form onSubmit={submit} className="card flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1">
            <span className="field-label">Nom du projet</span>
            <input
              autoFocus
              className="input"
              placeholder="Ex : Campagne WASH 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="btn-primary shrink-0" disabled={createBoard.isPending || !name.trim()}>
            <IconAdd className="h-5 w-5" /> Creer
          </button>
        </form>
      )}

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold text-[var(--text-dim)]">{total} projet(s)</span>
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
        <div className="ml-auto">
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {total === 0 && !boards.isLoading ? (
        <EmptyState
          icon={<IconKanban className="h-7 w-7" />}
          title="Aucun projet"
          hint="Creez votre premier projet pour organiser les taches de l'equipe."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <IconAdd className="h-5 w-5" /> Nouveau projet
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pg.slice.map((b) => (
            <Link
              key={b.id}
              to={`/projects/${b.id}`}
              className="card group space-y-3 transition hover:-translate-y-0.5 hover:shadow-elevation-2"
              style={b.color ? { borderTopColor: b.color, borderTopWidth: 3 } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-md font-semibold item-title">{b.name}</div>
                <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS_STYLE[b.status])}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
              {b.description && <p className="line-clamp-2 text-xs text-[var(--text-dim)]">{b.description}</p>}
              {b.progress && (
                <div className="space-y-1">
                  <ProgressBar pct={b.progress.pct} />
                  <div className="text-2xs text-[var(--text-dim)]">
                    {b.progress.done}/{b.progress.total} taches · {b.progress.pct}%
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-2xs text-[var(--text-dim)]">
                <span className="flex -space-x-1.5">
                  {b.lead && (
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-2xs font-bold text-white ring-2 ring-[var(--surface)]"
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
          {pg.total === 0 && <p className="col-span-full py-6 text-center text-sm text-[var(--text-dim)]">Aucun projet avec ce filtre.</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--outline)]">
          {pg.slice.map((b) => (
            <Link
              key={b.id}
              to={`/projects/${b.id}`}
              className="group flex items-center gap-3 border-b border-[var(--outline)] px-3 py-2.5 text-sm transition last:border-b-0 hover:bg-[var(--surface-2)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: b.color ?? 'var(--outline)' }}
              />
              <span className="min-w-0 flex-1 truncate font-medium item-title">{b.name}</span>
              {b.progress && (
                <span className="hidden w-40 shrink-0 items-center gap-2 sm:flex">
                  <ProgressBar pct={b.progress.pct} />
                  <span className="text-2xs text-[var(--text-dim)]">{b.progress.pct}%</span>
                </span>
              )}
              <span
                className={clsx(
                  'hidden shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold sm:inline',
                  STATUS_STYLE[b.status],
                )}
              >
                {STATUS_LABEL[b.status]}
              </span>
              {b.endDate && (
                <span className="hidden shrink-0 text-2xs text-[var(--text-dim)] md:inline">
                  {new Date(b.endDate).toLocaleDateString('fr-FR')}
                </span>
              )}
            </Link>
          ))}
          {pg.total === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--text-dim)]">Aucun projet avec ce filtre.</p>}
        </div>
      )}

      <Pagination
        page={pg.page}
        pageCount={pg.pageCount}
        onChange={pg.setPage}
        total={pg.total}
        start={pg.start}
        end={pg.end}
      />
    </div>
  );
}
