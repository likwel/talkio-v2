import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDialog } from '@/context/DialogContext';
import { useAuth } from '@/context/AuthContext';
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
  IconDelete,
  IconClose,
  IconAttach,
  IconFile,
  IconShare,
  IconPersonAdd,
} from '@/lib/icons';
import { downloadFormImportTemplate } from '@/lib/formImportTemplate';
import ShareFormModal from '@/components/ShareFormModal';
import AssignFormModal from '@/components/AssignFormModal';
import ViewToggle, { useViewMode } from '@/components/ViewToggle';
import EmptyState from '@/components/EmptyState';
import Pagination, { usePagination } from '@/components/Pagination';
import WorkspaceTag from '@/components/WorkspaceTag';

type Status = FormDef['status'];

const STATUS: Record<Status, { label: string; style: string }> = {
  DRAFT: { label: 'Brouillon', style: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
  PUBLISHED: { label: 'Publié', style: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  CLOSED: { label: 'Fermé', style: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
};

const publicUrl = (f: FormDef) => `${window.location.origin}/f/${f.publicCode ?? f.id}`;

async function downloadCsv(formId: string, title: string) {
  const res = await api.get(`/forms/${formId}/export.csv`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FormsPanel() {
  const { workspaces, personal } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const dialog = useDialog();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<FormDef | null>(null);
  const [assigning, setAssigning] = useState<FormDef | null>(null);
  const [mode, setMode] = useState<'all' | 'assigned'>('all');
  const [view, setView] = useViewMode('forms');
  const importRef = useRef<HTMLInputElement>(null);
  const targetWs = personal?.id ?? workspaces[0]?.id;

  const forms = useQuery({
    queryKey: ['forms', 'all'],
    queryFn: async () => (await api.get<FormDef[]>('/forms')).data,
  });
  const assigned = useQuery({
    queryKey: ['forms', 'assigned'],
    queryFn: async () => (await api.get<FormDef[]>('/forms/assigned')).data,
  });
  const pendingAssigned = (assigned.data ?? []).filter((f) => !f.assignment?.respondedAt).length;

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) =>
      (await api.put(`/forms/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms', 'all'] }),
  });

  async function importDefinition(file: File | undefined) {
    if (!file || !targetWs) return;
    try {
      const raw = JSON.parse(await file.text());
      // On accepte le fichier tel quel, ou emballe dans { definition: … }.
      const definition = raw?.definition ?? raw;
      await api.post('/forms/import', { workspaceId: targetWs, definition });
      qc.invalidateQueries({ queryKey: ['forms', 'all'] });
    } catch (err: any) {
      await dialog.alert({
        title: 'Import impossible',
        message:
          err?.response?.data?.error ??
          'Fichier JSON invalide. Telechargez le modèle « .talkioform.json » pour voir la structure attendue.',
      });
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  async function deleteForm(f: FormDef) {
    const ok = await dialog.confirm({
      title: 'Supprimer le formulaire',
      message: `« ${f.title} » et ses ${f._count?.responses ?? 0} réponse(s) seront definitivement supprimes pour tout le monde.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/forms/${f.id}`);
    } catch (err: any) {
      await dialog.alert({ title: 'Suppression impossible', message: err?.response?.data?.error ?? 'Action refusee.' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['forms'] });
  }

  async function removeFromMyList(f: FormDef) {
    const ok = await dialog.confirm({
      title: 'Retirer de ma liste',
      message: `« ${f.title} » sera retiré de vos formulaires attribués. Le formulaire n'est pas supprime.`,
      confirmLabel: 'Retirer',
    });
    if (!ok) return;
    await api.delete(`/forms/${f.id}/assignees/${user?.id}`);
    qc.invalidateQueries({ queryKey: ['forms', 'assigned'] });
  }

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

  const secondaryActions = (f: FormDef) => {
    const assignedToMe = mode === 'assigned' || !!f.assignment;
    const canManage = f.canManage ?? f.createdById === user?.id;
    return (
      <>
        <Link to={`/forms/${f.id}/fill`} className="btn-text btn-sm">
          <IconEye className="h-4 w-4" /> Saisir
        </Link>
        {!assignedToMe && (
          <>
            <Link to={`/forms/${f.id}/responses`} className="btn-text btn-sm">
              Réponses ({f._count?.responses ?? 0})
            </Link>
            <Link to={`/forms/${f.id}/edit`} className="btn-text btn-sm">
              <IconEdit className="h-4 w-4" /> Éditer
            </Link>
            <button onClick={() => setAssigning(f)} className="btn-text btn-sm">
              <IconPersonAdd className="h-4 w-4" /> Assigner
            </button>
            <button onClick={() => setSharing(f)} className="btn-text btn-sm">
              <IconShare className="h-4 w-4" /> Partager
            </button>
          </>
        )}
        <button onClick={() => downloadCsv(f.id, f.title)} className="btn-text btn-sm">
          <IconDownload className="h-4 w-4" /> CSV
        </button>
        {assignedToMe ? (
          <button onClick={() => removeFromMyList(f)} className="btn-text btn-sm text-red-500">
            <IconClose className="h-4 w-4" /> Retirer de ma liste
          </button>
        ) : (
          canManage && (
            <button onClick={() => deleteForm(f)} className="btn-text btn-sm text-red-500">
              <IconDelete className="h-4 w-4" /> Supprimer
            </button>
          )
        )}
      </>
    );
  };

  const list = (mode === 'assigned' ? assigned.data : forms.data) ?? [];
  const totals = useMemo(
    () => ({
      published: list.filter((f) => f.status === 'PUBLISHED').length,
      responses: list.reduce((s, f) => s + (f._count?.responses ?? 0), 0),
    }),
    [list],
  );
  const pg = usePagination(list, 12, `${view}-${mode}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--outline)] p-0.5 text-sm font-semibold">
          <button
            onClick={() => setMode('all')}
            className={
              'rounded-md px-2.5 py-1 transition ' +
              (mode === 'all' ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]')
            }
          >
            Tous
          </button>
          <button
            onClick={() => setMode('assigned')}
            className={
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 transition ' +
              (mode === 'assigned' ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]')
            }
          >
            Attribués à moi
            {pendingAssigned > 0 && (
              <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {pendingAssigned}
              </span>
            )}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>{list.length} formulaire(s)</Chip>
          <Chip dim>{totals.published} publié(s)</Chip>
          <Chip dim>{totals.responses} réponse(s)</Chip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {mode === 'all' && (
            <>
              <button
                className="btn-text btn-sm"
                onClick={downloadFormImportTemplate}
                title="Telecharger un modèle JSON d'import"
              >
                <IconFile className="h-4 w-4" /> Modèle JSON
              </button>
              <button className="btn-outlined btn-sm" onClick={() => importRef.current?.click()}>
                <IconAttach className="h-4 w-4" /> Importer
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => importDefinition(e.target.files?.[0])}
              />
              <Link to="/forms/new" className="btn-primary btn-sm">
                <IconAdd className="h-4 w-4" /> Créer un formulaire
              </Link>
            </>
          )}
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {list.length === 0 && !forms.isLoading ? (
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pg.slice.map((f) => (
            <div
              key={f.id}
              className="card group flex flex-col gap-3 transition hover:-translate-y-0.5 hover:border-[var(--accent-soft)] hover:shadow-elevation-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold item-title">{f.title}</span>
                <span
                  className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS[f.status].style)}
                >
                  {STATUS[f.status].label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <WorkspaceTag ws={f.workspace} />
                {f.project && (
                  <Link
                    to={`/meal/projects/${f.project.id}?t=collecte`}
                    className="inline-flex items-center rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--accent-strong)] hover:brightness-95"
                  >
                    ↗ {f.project.name}
                  </Link>
                )}
                <Chip dim>{f._count?.fields ?? 0} champs</Chip>
                {f._count?.sections ? <Chip dim>{f._count.sections} sections</Chip> : null}
                <Chip dim>{f._count?.responses ?? 0} réponses</Chip>
                {f.status === 'PUBLISHED' && f.version ? <Chip dim>v{f.version}</Chip> : null}
                {f.assignment && (
                  <span
                    className={
                      'inline-flex items-center rounded-md px-1.5 py-0.5 text-2xs font-semibold ' +
                      (f.assignment.respondedAt
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')
                    }
                  >
                    {f.assignment.respondedAt ? 'Répondu' : 'À remplir'}
                    {f.assignment.assignedBy && ` · ${f.assignment.assignedBy.fullName}`}
                  </span>
                )}
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
              {f.project && (
                <Link
                  to={`/meal/projects/${f.project.id}?t=collecte`}
                  className="hidden shrink-0 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--accent-strong)] sm:inline-flex"
                >
                  ↗ {f.project.name}
                </Link>
              )}
              <WorkspaceTag ws={f.workspace} className="hidden sm:inline-flex" />
              <span className="shrink-0 text-2xs text-[var(--text-dim)]">
                {f._count?.fields ?? 0} champs · {f._count?.responses ?? 0} rép.
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

      <ShareFormModal form={sharing} onClose={() => setSharing(null)} />
      <AssignFormModal
        form={assigning}
        onClose={() => setAssigning(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ['forms'] })}
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
