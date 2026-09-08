import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Project } from '@/lib/types';
import { IconAnalytics, IconAdd, IconClose, IconNext } from '@/lib/icons';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';

const AV = ['#0cae36', '#2563eb', '#d946ef', '#f59e0b', '#ef4444', '#14b8a6', '#8b5cf6', '#ec4899'];
const tint = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
};

export default function Meal() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', donor: '' });
  const [view, setView] = useViewMode('meal');
  const [addOpen, setAddOpen] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Project[]>('/meal/projects', { params: { workspaceId: current!.id } })).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/meal/projects', { workspaceId: current!.id, ...form })).data,
    onSuccess: () => {
      setForm({ name: '', code: '', donor: '' });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ['projects', current?.id] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim()) create.mutate();
  }

  const list = projects.data ?? [];
  const pg = usePagination(list, 12, view);

  return (
    <div className="page max-w-8xl space-y-5">
      {/* En-tete */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">
            <IconAnalytics className="h-6 w-6 text-[var(--accent)]" /> MEAL
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            Suivi, evaluation, redevabilite &amp; apprentissage : cadre logique, indicateurs et releves de mesures.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? <IconClose className="h-5 w-5" /> : <IconAdd className="h-5 w-5" />}
          {addOpen ? 'Fermer' : 'Nouveau projet'}
        </button>
      </div>

      {addOpen && (
        <form onSubmit={submit} className="card grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="field-label">Nom du projet</span>
            <input
              autoFocus
              className="input"
              placeholder="Ex : Acces a l'eau — District Nord"
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
          <button className="btn-primary sm:col-span-4 sm:w-48" disabled={create.isPending || !form.name.trim()}>
            <IconAdd className="h-5 w-5" /> Creer le projet
          </button>
        </form>
      )}

      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-dim)]">{list.length} projet(s)</span>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {list.length === 0 && !projects.isLoading ? (
        <EmptyState
          icon={<IconAnalytics className="h-7 w-7" />}
          title="Aucun projet MEAL"
          hint="Creez un projet pour definir son cadre logique et suivre ses indicateurs."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <IconAdd className="h-5 w-5" /> Nouveau projet
            </button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pg.slice.map((p) => (
            <Link
              key={p.id}
              to={`/meal/projects/${p.id}`}
              className="card group flex flex-col gap-2.5 transition hover:-translate-y-0.5 hover:shadow-elevation-2"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ background: tint(p.id) }}
                >
                  {(p.code || p.name).slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold item-title">{p.name}</span>
              </div>
              <div className="text-xs text-[var(--text-dim)]">
                {p.code || '—'} {p.donor && `· ${p.donor}`}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--outline)] pt-2 text-2xs text-[var(--text-dim)]">
                <span>
                  {p._count?.indicators ?? 0} indicateurs · {p._count?.forms ?? 0} formulaires
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
              <span className="hidden shrink-0 text-2xs text-[var(--text-dim)] sm:inline">
                {p.code} {p.donor && `· ${p.donor}`}
              </span>
              <span className="shrink-0 text-2xs text-[var(--text-dim)]">
                {p._count?.indicators ?? 0} ind. · {p._count?.forms ?? 0} form.
              </span>
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
