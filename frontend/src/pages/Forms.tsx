import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import type { FormDef } from '@/lib/types';
import {
  IconAdd,
  IconDownload,
  IconForms,
  IconPublish,
  IconUnpublish,
  IconCopy,
  IconEye,
  IconEdit,
  IconAttach,
} from '@/lib/icons';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';
import WorkspaceTag from '@/components/WorkspaceTag';

type Status = FormDef['status'];

async function downloadCsv(formId: string, title: string) {
  const res = await api.get(`/forms/${formId}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS: Record<Status, { label: string; style: string }> = {
  DRAFT: { label: 'Brouillon', style: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
  PUBLISHED: { label: 'Publié', style: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  CLOSED: { label: 'Fermé', style: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
};

const publicUrl = (f: FormDef) => `${window.location.origin}/f/${f.publicCode ?? f.id}`;

export default function Forms() {
  const { workspaces, personal } = useWorkspace();
  const qc = useQueryClient();
  const dialog = useDialog();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [view, setView] = useViewMode('forms');
  const importRef = useRef<HTMLInputElement>(null);
  const targetWs = personal?.id ?? workspaces[0]?.id;

  async function importDefinition(file: File | undefined) {
    if (!file || !targetWs) return;
    try {
      const definition = JSON.parse(await file.text());
      await api.post('/forms/import', { workspaceId: targetWs, definition });
      qc.invalidateQueries({ queryKey: ['forms', 'all'] });
    } catch {
      await dialog.alert({ title: 'Import impossible', message: 'Fichier .talkioform.json invalide.' });
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  const forms = useQuery({
    queryKey: ['forms', 'all'],
    queryFn: async () => (await api.get<FormDef[]>('/forms')).data,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) =>
      (await api.put(`/forms/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', 'all'] }),
  });

  async function copyLink(f: FormDef) {
    try {
      await navigator.clipboard.writeText(publicUrl(f));
      setCopiedId(f.id);
      setTimeout(() => setCopiedId((c) => (c === f.id ? null : c)), 1800);
    } catch {
      await dialog.alert({ title: 'Lien public', message: publicUrl(f) });
    }
  }

  async function closeForm(f: FormDef) {
    const ok = await dialog.confirm({
      title: 'Fermer le formulaire',
      message: `« ${f.title} » n'acceptera plus de nouvelles réponses. Vous pourrez le rouvrir plus tard.`,
      confirmLabel: 'Fermer',
      danger: true,
    });
    if (ok) setStatus.mutate({ id: f.id, status: 'CLOSED' });
  }

  const primaryActions = (f: FormDef) => (
    <>
      {f.status === 'DRAFT' && (
        <button
          className="btn-primary btn-sm"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ id: f.id, status: 'PUBLISHED' })}
        >
          <IconPublish className="h-4 w-4" /> Publier
        </button>
      )}
      {f.status === 'PUBLISHED' && (
        <>
          <button className="btn-primary btn-sm" onClick={() => copyLink(f)}>
            <IconCopy className="h-4 w-4" />
            {copiedId === f.id ? 'Lien copié' : 'Copier le lien'}
          </button>
          <a href={publicUrl(f)} target="_blank" rel="noreferrer" className="btn-outlined btn-sm">
            <IconEye className="h-4 w-4" /> Ouvrir
          </a>
          <button className="btn-outlined btn-sm" disabled={setStatus.isPending} onClick={() => closeForm(f)}>
            <IconUnpublish className="h-4 w-4" /> Fermer
          </button>
        </>
      )}
      {f.status === 'CLOSED' && (
        <button
          className="btn-outlined btn-sm"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate({ id: f.id, status: 'PUBLISHED' })}
        >
          <IconPublish className="h-4 w-4" /> Rouvrir
        </button>
      )}
    </>
  );

  const secondaryActions = (f: FormDef) => (
    <>
      <Link to={`/forms/${f.id}/fill`} className="btn-text btn-sm">
        <IconEye className="h-4 w-4" /> Saisir
      </Link>
      <Link to={`/forms/${f.id}/responses`} className="btn-text btn-sm">
        Réponses ({f._count?.responses ?? 0})
      </Link>
      <Link to={`/forms/${f.id}/edit`} className="btn-text btn-sm">
        <IconEdit className="h-4 w-4" /> Éditer
      </Link>
      <button onClick={() => downloadCsv(f.id, f.title)} className="btn-text btn-sm">
        <IconDownload className="h-4 w-4" /> CSV
      </button>
    </>
  );

  const total = forms.data?.length ?? 0;
  const pg = usePagination(forms.data ?? [], 12, view);

  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={<IconForms className="h-6 w-6 shrink-0 text-[var(--accent)]" />} title="Collecte">
        <button className="btn-outlined" onClick={() => importRef.current?.click()}>
          <IconAttach className="h-4 w-4" />
          <span className="hidden sm:inline">Importer</span>
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => importDefinition(e.target.files?.[0])}
        />
        <Link to="/forms/new" className="btn-primary">
          <IconAdd className="h-5 w-5" />
          <span className="hidden sm:inline">Nouveau formulaire</span>
        </Link>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="page max-w-8xl space-y-5">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-dim)]">{total} formulaire(s)</span>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {total === 0 && !forms.isLoading ? (
        <EmptyState
          icon={<IconForms className="h-7 w-7" />}
          title="Aucun formulaire"
          hint="Créez un formulaire d'enquête personnalisable, puis publiez-le pour récolter des réponses."
          action={
            <Link to="/forms/new" className="btn-primary">
              <IconAdd className="h-5 w-5" /> Nouveau formulaire
            </Link>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pg.slice.map((f) => (
            <div
              key={f.id}
              className="card group flex flex-col gap-3 transition hover:shadow-elevation-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold item-title">{f.title}</span>
                <span
                  className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS[f.status].style)}
                >
                  {STATUS[f.status].label}
                </span>
              </div>
              <WorkspaceTag ws={f.workspace} />
              <div className="text-xs text-[var(--text-dim)]">
                {f._count?.fields ?? 0} champs
                {f._count?.sections ? ` · ${f._count.sections} sections` : ''} · {f._count?.responses ?? 0} réponses
                {f.status === 'PUBLISHED' && f.version ? ` · v${f.version}` : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">{primaryActions(f)}</div>
              <div className="mt-auto flex flex-wrap gap-1 border-t border-[var(--outline)] pt-2 text-sm">
                {secondaryActions(f)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--outline)]">
          {pg.slice.map((f) => (
            <div
              key={f.id}
              className="group flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--outline)] px-3 py-2.5 last:border-b-0"
            >
              <span
                className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS[f.status].style)}
              >
                {STATUS[f.status].label}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium item-title">{f.title}</span>
              <WorkspaceTag ws={f.workspace} className="hidden sm:inline-flex" />
              <span className="shrink-0 text-2xs text-[var(--text-dim)]">
                {f._count?.fields ?? 0} champs · {f._count?.responses ?? 0} rep.
              </span>
              <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                {primaryActions(f)}
                {secondaryActions(f)}
              </div>
            </div>
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
      </div>
    </div>
  );
}
