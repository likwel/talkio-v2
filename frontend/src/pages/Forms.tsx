import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { FormDef } from '@/lib/types';
import { IconAdd, IconDownload, IconForms } from '@/lib/icons';

async function downloadCsv(formId: string, title: string) {
  const res = await api.get(`/forms/${formId}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  PUBLISHED: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  CLOSED: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

export default function Forms() {
  const { current } = useWorkspace();

  const forms = useQuery({
    queryKey: ['forms', current?.id],
    enabled: !!current,
    queryFn: async () => (await api.get<FormDef[]>('/forms', { params: { workspaceId: current!.id } })).data,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">
            <IconForms className="h-6 w-6 text-brand-600" /> Collecte de donnees
          </h1>
          <p className="text-slate-500">Formulaires dynamiques, saisie terrain et export CSV</p>
        </div>
        <Link to="/forms/new" className="btn-primary">
          <IconAdd className="h-5 w-5" /> Nouveau formulaire
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {forms.data?.map((f) => (
          <div key={f.id} className="card space-y-2 transition hover:shadow-elevation-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{f.title}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[f.status]}`}>
                {f.status}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {f._count?.fields ?? 0} champs · {f._count?.responses ?? 0} reponses
            </div>
            <div className="flex flex-wrap gap-1 pt-1 text-sm">
              <Link to={`/forms/${f.id}/fill`} className="btn-text h-8">
                Saisir
              </Link>
              <Link to={`/forms/${f.id}/edit`} className="btn-text h-8">
                Editer
              </Link>
              <button onClick={() => downloadCsv(f.id, f.title)} className="btn-text h-8">
                <IconDownload className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </div>
        ))}
        {forms.data?.length === 0 && <p className="text-slate-400">Aucun formulaire.</p>}
      </div>
    </div>
  );
}
