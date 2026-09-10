import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Project } from '@/lib/types';
import { IconAdd, IconClose, IconNext } from '@/lib/icons';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';
import WorkspaceTag, { WorkspacePicker } from '@/components/WorkspaceTag';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};

export default function ProjectsPanel() {
  const { workspaces, personal } = useWorkspace();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', donor: '' });
  const [wsId, setWsId] = useState('');
  const [view, setView] = useViewMode('meal');
  const [addOpen, setAddOpen] = useState(false);
  const targetWs = wsId || personal?.id || workspaces[0]?.id;

  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: async () => (await api.get<Project[]>('/meal/projects')).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/meal/projects', { workspaceId: targetWs, ...form })).data,
    onSuccess: () => {
      setForm({ name: '', code: '', donor: '' });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['projects', 'all'] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim()) create.mutate();
  }

  const list = projects.data ?? [];
  const totals = useMemo(
    () => ({
      indicators: list.reduce((s, p) => s + (p._count?.indicators ?? 0), 0),
      forms: list.reduce((s, p) => s + (p._count?.forms ?? 0), 0),
    }),
    [list],
  );
  const pg = usePagination(list, 12, view);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{list.length} projet(s)</Chip>
          <Chip dim>{totals.indicators} indicateur(s)</Chip>
          <Chip dim>{totals.forms} formulaire(s) lié(s)</Chip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-primary btn-sm" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? <IconClose className="h-4 w-4" /> : <IconAdd className="h-4 w-4" />}
            {addOpen ? 'Fermer' : 'Créer un projet'}
          </button>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {addOpen && (
        <form onSubmit={submit} className="card grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="field-label">Nom du projet</span>
            <input
              autoFocus
              className="input"
              placeholder="Ex : Accès à l'eau — District Nord"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Code</span>
            <input
              className="input"
              placeholder="WASH-2026"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">Bailleur</span>
            <input
              className="input"
              placeholder="Optionnel"
              value={form.donor}
              onChange={(e) => setForm({ ...form, donor: e.target.value })}
            />
          </label>
          <WorkspacePicker
            value={targetWs ?? ''}
            onChange={setWsId}
            options={workspaces.map((w) => ({ id: w.id, name: w.name, isPersonal: w.isPersonal }))}
          />
          <button className="btn-primary sm:col-span-4 sm:w-48" disabled={create.isPending || !form.name.trim()}>
            <IconAdd className="h-5 w-5" /> Créer le projet
          </button>
        </form>
      )}

      {list.length === 0 && !projects.isLoading ? (
        <EmptyState
          icon={<IconAdd className="h-7 w-7" />}
          title="Aucun projet MEAL"
          hint="Créez un projet pour définir son cadre logique et suivre ses indicateurs."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <IconAdd className="h-5 w-5" /> Nouveau projet
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pg.slice.map((p) => (
            <Link
              key={p.id}
              to={`/meal/projects/${p.id}`}
              className="card group flex flex-col gap-2.5 transition hover:bg-[var(--surface-2)]"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ background: tint(p.id) }}
                >
                  {(p.code || p.name).slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold item-title">{p.name}</span>
                  <span className="block truncate text-2xs text-[var(--text-dim)]">
                    {p.code || '—'}
                    {p.donor && ` · ${p.donor}`}
                  </span>
                </span>
                <WorkspaceTag ws={p.workspace} />
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--outline)] pt-2 text-2xs text-[var(--text-dim)]">
                <span className="flex gap-1.5">
                  <Chip dim>{p._count?.indicators ?? 0} indic.</Chip>
                  <Chip dim>{p._count?.forms ?? 0} form.</Chip>
                </span>
                <IconNext className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--outline)]">
          {pg.slice.map((p) => (
            <Link
              key={p.id}
              to={`/meal/projects/${p.id}`}
              className="group flex items-center gap-3 border-b border-[var(--outline)] px-3 py-2.5 text-sm transition last:border-b-0 hover:bg-[var(--surface-2)]"
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-2xs font-bold text-white"
                style={{ background: tint(p.id) }}
              >
                {(p.code || p.name).slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium item-title">{p.name}</span>
              <WorkspaceTag ws={p.workspace} className="hidden sm:inline-flex" />
              <span className="hidden shrink-0 text-2xs text-[var(--text-dim)] md:inline">
                {p.code} {p.donor && `· ${p.donor}`}
              </span>
              <span className="shrink-0 text-2xs text-[var(--text-dim)]">
                {p._count?.indicators ?? 0} ind. · {p._count?.forms ?? 0} form.
              </span>
              <IconNext className="h-4 w-4 shrink-0 text-[var(--text-dim)] transition group-hover:translate-x-0.5" />
            </Link>
          ))}
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

function Chip({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-semibold ' +
        (dim ? 'bg-[var(--surface-2)] text-[var(--text-dim)]' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]')
      }
    >
      {children}
    </span>
  );
}
