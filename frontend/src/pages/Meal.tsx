import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Project } from '@/lib/types';
import { IconAnalytics, IconAdd } from '@/lib/icons';

export default function Meal() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', code: '', donor: '' });

  const projects = useQuery({
    queryKey: ['projects', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<Project[]>('/meal/projects', { params: { workspaceId: current!.id } })).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post('/meal/projects', { workspaceId: current!.id, ...form })).data,
    onSuccess: () => {
      setForm({ name: '', code: '', donor: '' });
      qc.invalidateQueries({ queryKey: ['projects', current?.id] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim()) create.mutate();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">
          <IconAnalytics className="h-6 w-6 text-brand-600" /> MEAL — Suivi, evaluation, redevabilite & apprentissage
        </h1>
        <p className="text-slate-500">Cadre logique, indicateurs et releves de mesures par projet</p>
      </div>

      <form onSubmit={submit} className="card grid gap-3 sm:grid-cols-4">
        <input
          className="input sm:col-span-2"
          placeholder="Nom du projet"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Code (ex: WASH-2026)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <input
          className="input"
          placeholder="Bailleur"
          value={form.donor}
          onChange={(e) => setForm({ ...form, donor: e.target.value })}
        />
        <button className="btn-primary sm:col-span-4 sm:w-48" disabled={create.isPending}>
          <IconAdd className="h-5 w-5" /> Creer le projet
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.data?.map((p) => (
          <Link
            key={p.id}
            to={`/meal/projects/${p.id}`}
            className="card transition hover:-translate-y-0.5 hover:shadow-elevation-2"
          >
            <div className="text-lg font-medium">{p.name}</div>
            <div className="text-sm text-slate-500">
              {p.code} {p.donor && `· ${p.donor}`}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {p._count?.indicators ?? 0} indicateurs · {p._count?.forms ?? 0} formulaires
            </div>
          </Link>
        ))}
        {projects.data?.length === 0 && <p className="text-slate-400">Aucun projet.</p>}
      </div>
    </div>
  );
}
