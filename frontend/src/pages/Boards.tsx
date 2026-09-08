import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Board } from '@/lib/types';
import { IconAdd, IconKanban } from '@/lib/icons';

export default function Boards() {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState('');

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <h1 className="flex items-center gap-2 text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">
        <IconKanban className="h-6 w-6 text-brand-600" /> Tableaux Kanban
      </h1>

      <form onSubmit={submit} className="flex max-w-md gap-2">
        <input className="input" placeholder="Nom du tableau" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={createBoard.isPending}>
          <IconAdd className="h-5 w-5" /> Creer
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.data?.map((b) => (
          <Link
            key={b.id}
            to={`/boards/${b.id}`}
            className="card transition hover:-translate-y-0.5 hover:shadow-elevation-2"
          >
            <div className="text-lg font-medium">{b.name}</div>
            <div className="text-sm text-slate-500">{b._count?.columns ?? 0} colonnes</div>
          </Link>
        ))}
        {boards.data?.length === 0 && <p className="text-slate-400">Aucun tableau pour le moment.</p>}
      </div>
    </div>
  );
}
