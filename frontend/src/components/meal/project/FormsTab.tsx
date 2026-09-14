import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { FormDef, Project } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import ShareFormModal from '@/components/ShareFormModal';
import AssignFormModal from '@/components/AssignFormModal';
import EmptyState from '@/components/EmptyState';
import { SectionHeading } from '@/components/meal/mealUi';
import { IconAdd, IconCopy, IconEye, IconEdit, IconClose, IconDownload, IconDelete, IconShare, IconPersonAdd, IconForms } from '@/lib/icons';

const STATUS: Record<FormDef['status'], { label: string; style: string }> = {
  DRAFT: { label: 'Brouillon', style: 'bg-[var(--surface-2)] text-[var(--text-dim)]' },
  PUBLISHED: { label: 'Publié', style: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' },
  CLOSED: { label: 'Fermé', style: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};
const publicUrl = (f: FormDef) => `${window.location.origin}/f/${f.publicCode ?? f.id}`;

export default function FormsTab({ project }: { project: Project }) {
  const dialog = useDialog();
  const [attach, setAttach] = useState(false);
  const [pick, setPick] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [sharing, setSharing] = useState<FormDef | null>(null);
  const [assigning, setAssigning] = useState<FormDef | null>(null);

  const linked = useQuery({
    queryKey: ['forms', 'project', project.id],
    queryFn: async () => (await api.get<FormDef[]>('/forms', { params: { projectId: project.id } })).data,
  });

  const wsForms = useQuery({
    queryKey: ['forms', 'ws', project.workspaceId],
    enabled: attach && !!project.workspaceId,
    queryFn: async () =>
      (await api.get<FormDef[]>('/forms', { params: { workspaceId: project.workspaceId } })).data,
  });

  const list = linked.data ?? [];
  const attachable = useMemo(
    () => (wsForms.data ?? []).filter((f) => f.projectId !== project.id),
    [wsForms.data, project.id],
  );
  const totalResponses = list.reduce((s, f) => s + (f._count?.responses ?? 0), 0);

  async function link(id: string) {
    if (!id) return;
    await api.put(`/forms/${id}`, { projectId: project.id });
    setPick('');
    setAttach(false);
    linked.refetch();
  }
  async function unlink(f: FormDef) {
    const ok = await dialog.confirm({
      title: 'Détacher le formulaire',
      message: `« ${f.title} » ne sera plus rattaché a ce projet (il n'est pas supprime).`,
      confirmLabel: 'Détacher',
    });
    if (ok) {
      await api.put(`/forms/${f.id}`, { projectId: null });
      linked.refetch();
    }
  }
  async function copyLink(f: FormDef) {
    try {
      await navigator.clipboard.writeText(publicUrl(f));
      setCopied(f.id);
      setTimeout(() => setCopied((c) => (c === f.id ? null : c)), 1800);
    } catch {
      await dialog.alert({ title: 'Lien public', message: publicUrl(f) });
    }
  }
  async function destroy(f: FormDef) {
    const ok = await dialog.confirm({
      title: 'Supprimer le formulaire',
      message: `« ${f.title} » et ses ${f._count?.responses ?? 0} réponse(s) seront definitivement supprimes.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) {
      await api.delete(`/forms/${f.id}`);
      linked.refetch();
    }
  }
  async function csv(f: FormDef) {
    const res = await api.get(`/forms/${f.id}/export.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconForms}
        tone="emerald"
        title="Collecte de données"
        subtitle={`${list.length} formulaire(s) lie(s) · ${totalResponses} réponse(s)`}
        action={
          <>
            <button className="btn-outlined btn-sm" onClick={() => setAttach((v) => !v)}>
              {attach ? <IconClose className="h-4 w-4" /> : <IconAdd className="h-4 w-4" />} Lier un formulaire
            </button>
            <Link to={`/forms/new?projectId=${project.id}`} className="btn-primary btn-sm">
              <IconAdd className="h-4 w-4" /> Créer un formulaire
            </Link>
          </>
        }
      />

      {attach && (
        <div className="card flex flex-wrap items-end gap-2">
          <label className="min-w-[240px] flex-1">
            <span className="field-label">Formulaire existant de l'espace</span>
            <Select
              value={pick}
              onChange={setPick}
              placeholder={attachable.length ? 'Choisir un formulaire…' : 'Aucun formulaire disponible'}
              options={attachable.map((f) => ({
                value: f.id,
                label: f.projectId ? `${f.title} (déjà lie ailleurs)` : f.title,
              }))}
            />
          </label>
          <button className="btn-primary btn-sm" disabled={!pick} onClick={() => link(pick)}>
            Lier au projet
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<IconForms className="h-7 w-7" />}
          title="Aucun formulaire rattaché"
          hint="Créez-en un ou liez un formulaire existant pour collecter les données de ce projet."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((f) => (
            <div key={f.id} className="card flex flex-col gap-2.5 transition hover:border-[var(--accent-soft)] hover:shadow-elevation-1">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-semibold">{f.title}</span>
                <span
                  className={clsx('shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold', STATUS[f.status].style)}
                >
                  {STATUS[f.status].label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-2xs text-[var(--text-dim)]">
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">{f._count?.fields ?? 0} champs</span>
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">{f._count?.responses ?? 0} réponses</span>
                {f.status === 'PUBLISHED' && f.version ? (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">v{f.version}</span>
                ) : null}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-[var(--outline)] pt-2 text-sm">
                {f.status === 'PUBLISHED' && (
                  <button className="btn-text btn-sm" onClick={() => copyLink(f)}>
                    <IconCopy className="h-4 w-4" /> {copied === f.id ? 'Lien copie' : 'Lien'}
                  </button>
                )}
                <Link to={`/forms/${f.id}/fill`} className="btn-text btn-sm">
                  <IconEye className="h-4 w-4" /> Saisir
                </Link>
                <Link to={`/forms/${f.id}/responses`} className="btn-text btn-sm">
                  Réponses ({f._count?.responses ?? 0})
                </Link>
                <Link to={`/forms/${f.id}/edit?projectId=${project.id}`} className="btn-text btn-sm">
                  <IconEdit className="h-4 w-4" /> Editer
                </Link>
                <button className="btn-text btn-sm" onClick={() => csv(f)}>
                  <IconDownload className="h-4 w-4" /> CSV
                </button>
                <button className="btn-text btn-sm" onClick={() => setAssigning(f)}>
                  <IconPersonAdd className="h-4 w-4" /> Assigner
                </button>
                <button className="btn-text btn-sm" onClick={() => setSharing(f)}>
                  <IconShare className="h-4 w-4" /> Partager
                </button>
                <button className="btn-text btn-sm" onClick={() => unlink(f)}>
                  <IconClose className="h-4 w-4" /> Détacher
                </button>
                {f.canManage !== false && (
                  <button className="btn-text btn-sm text-red-500" onClick={() => destroy(f)}>
                    <IconDelete className="h-4 w-4" /> Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ShareFormModal form={sharing} onClose={() => setSharing(null)} />
      <AssignFormModal form={assigning} onClose={() => setAssigning(null)} onChanged={() => linked.refetch()} />
    </div>
  );
}
