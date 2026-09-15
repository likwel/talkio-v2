import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Board, BoardStatus } from '@/lib/types';
import { IconAdd, IconKanban, IconClose, IconEdit, IconSearch, IconSort } from '@/lib/icons';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';
import BoardSettingsModal from '@/components/BoardSettingsModal';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import Select from '@/components/Select';
import WorkspaceTag, { WorkspacePicker } from '@/components/WorkspaceTag';
import FilterSidebar from '@/components/FilterSidebar';

type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc' | 'due' | 'progress';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' },
  { value: 'name-asc', label: 'Nom (A → Z)' },
  { value: 'name-desc', label: 'Nom (Z → A)' },
  { value: 'due', label: 'Échéance la plus proche' },
  { value: 'progress', label: 'Progression décroissante' },
];

export const STATUS_LABEL: Record<BoardStatus, string> = {
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
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
  const { workspaces, personal } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [wsId, setWsId] = useState('');
  const [filter, setFilter] = useState<'all' | BoardStatus>('all');
  const [wsFilter, setWsFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [view, setView] = useViewMode('boards');
  const [addOpen, setAddOpen] = useState(false);
  const [editBoard, setEditBoard] = useState<Board | null>(null);
  const targetWs = wsId || personal?.id || workspaces[0]?.id;

  const boards = useQuery({
    queryKey: ['boards', 'all'],
    queryFn: async () => (await api.get<Board[]>('/boards')).data,
  });

  const createBoard = useMutation({
    mutationFn: async () => (await api.post('/boards', { workspaceId: targetWs, name })).data,
    onSuccess: () => {
      setName('');
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['boards', 'all'] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) createBoard.mutate();
  }

  const filtered = useMemo(
    () =>
      (boards.data ?? []).filter(
        (b) => (filter === 'all' || b.status === filter) && (wsFilter === 'all' || b.workspaceId === wsFilter),
      ),
    [boards.data, filter, wsFilter],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? filtered.filter((b) => b.name.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q))
      : filtered;
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'fr');
        case 'name-desc':
          return b.name.localeCompare(a.name, 'fr');
        case 'due':
          return (a.endDate ? new Date(a.endDate).getTime() : Infinity) - (b.endDate ? new Date(b.endDate).getTime() : Infinity);
        case 'progress':
          return (b.progress?.pct ?? -1) - (a.progress?.pct ?? -1);
        case 'oldest':
          return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        case 'recent':
        default:
          return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      }
    });
    return sorted;
  }, [filtered, search, sortBy]);

  const total = boards.data?.length ?? 0;
  const pg = usePagination(shown, 12, `${filter}|${wsFilter}|${search}|${sortBy}|${view}`);

  const STATUSES = ['all', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
  const statusItems = STATUSES.map((s) => ({
    key: s,
    label: s === 'all' ? 'Tous' : STATUS_LABEL[s],
    count: s === 'all' ? total : (boards.data ?? []).filter((b) => b.status === s).length,
  }));
  const workspaceItems = [
    { key: 'all', label: 'Tous les espaces', count: total },
    ...workspaces.map((w) => ({
      key: w.id,
      label: w.isPersonal ? 'Personnel' : w.name,
      count: (boards.data ?? []).filter((b) => b.workspaceId === w.id).length,
    })),
  ];
  const hasActiveFilters = filter !== 'all' || wsFilter !== 'all' || search.trim() !== '';
  function resetFilters() {
    setFilter('all');
    setWsFilter('all');
    setSearch('');
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={<IconKanban className="h-6 w-6 shrink-0 text-[var(--accent)]" />} title="Projets">
        <button className="btn-primary" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? <IconClose className="h-5 w-5" /> : <IconAdd className="h-5 w-5" />}
          <span className="hidden sm:inline">{addOpen ? 'Fermer' : 'Créer'}</span>
        </button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page max-w-8xl space-y-4">
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
          <WorkspacePicker
            className="w-44"
            value={targetWs ?? ''}
            onChange={setWsId}
            options={workspaces.map((w) => ({ id: w.id, name: w.name, isPersonal: w.isPersonal }))}
          />
          <button className="btn-primary shrink-0" disabled={createBoard.isPending || !name.trim()}>
            <IconAdd className="h-5 w-5" /> Créer
          </button>
        </form>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <FilterSidebar
          onReset={hasActiveFilters ? resetFilters : undefined}
          groups={[
            {
              title: 'Statut',
              value: filter,
              onChange: (k) => setFilter(k as typeof filter),
              items: statusItems,
            },
            ...(workspaces.length > 1
              ? [
                  {
                    title: 'Espace de travail',
                    value: wsFilter,
                    onChange: setWsFilter,
                    items: workspaceItems,
                  },
                ]
              : []),
          ]}
        />
        <div className="min-w-0 flex-1 space-y-4">
      {/* Barre d'outils : recherche + tri + affichage */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            className="input h-9 pl-9 pr-8"
            placeholder="Rechercher un projet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-dim)] hover:text-[var(--text)]"
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconSort className="hidden h-4 w-4 text-[var(--text-dim)] sm:block" />
          <Select
            className="h-9 w-44"
            aria-label="Trier par"
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <ViewToggle value={view} onChange={setView} />
        <span className="w-full shrink-0 text-2xs text-[var(--text-dim)] sm:w-auto sm:text-sm sm:font-semibold">
          {pg.total} projet(s)
        </span>
      </div>

      {total === 0 && !boards.isLoading ? (
        <EmptyState
          icon={<IconKanban className="h-7 w-7" />}
          title="Aucun projet"
          hint="Créez votre premier projet pour organiser les tâches de l'équipe."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <IconAdd className="h-5 w-5" /> Nouveau projet
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pg.slice.map((b) => (
            <div key={b.id} className="group relative">
              <Link
                to={`/projects/${b.id}`}
                className="card block space-y-3 transition hover:-translate-y-0.5 hover:shadow-elevation-2"
              >
                <div className="flex items-start justify-between gap-2 pr-7">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {b.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />}
                    <span className="truncate text-md font-semibold item-title">{b.name}</span>
                  </span>
                  <span className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS_STYLE[b.status])}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
              <WorkspaceTag ws={b.workspace} />
              {b.description && <p className="line-clamp-2 text-xs text-[var(--text-dim)]">{b.description}</p>}
              {b.progress && (
                <div className="space-y-1">
                  <ProgressBar pct={b.progress.pct} />
                  <div className="text-2xs text-[var(--text-dim)]">
                    {b.progress.done}/{b.progress.total} tâches · {b.progress.pct}%
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-2xs text-[var(--text-dim)]">
                <span className="flex -space-x-1.5">
                  {b.lead && (
                    <span className="rounded-full ring-2 ring-[var(--surface)]" title={`Chef : ${b.lead.fullName}`}>
                      <Avatar id={b.lead.id} name={b.lead.fullName} src={b.lead.avatarUrl} size={24} />
                    </span>
                  )}
                  {(b._count?.members ?? 0) > 0 && <span className="pl-2">{b._count?.members} membre(s)</span>}
                </span>
                {b.endDate && <span>Échéance {new Date(b.endDate).toLocaleDateString('fr-FR')}</span>}
              </div>
              </Link>
              <button
                className="icon-btn-sm absolute right-2 top-2 bg-[var(--surface)] opacity-0 shadow-elevation-1 transition group-hover:opacity-100 focus:opacity-100"
                onClick={() => setEditBoard(b)}
                title="Modifier le projet"
              >
                <IconEdit className="h-4 w-4" />
              </button>
            </div>
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
              <WorkspaceTag ws={b.workspace} className="hidden sm:inline-flex" />
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
      </div>
        </div>
      </div>

      {editBoard && (
        <BoardSettingsModal
          board={editBoard}
          open
          onClose={() => setEditBoard(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['boards', 'all'] })}
        />
      )}
    </div>
  );
}
