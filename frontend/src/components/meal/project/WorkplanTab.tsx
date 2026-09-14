import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import type { Activity, ActivityStatus, Board, Project, User } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import Modal from '@/components/Modal';
import { IconAdd, IconDelete, IconList, IconCalendar, IconCheck, IconLink, IconUnlink, IconKanban } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { ACTIVITY_STATUS, Badge, Bar, Field, SectionHeading, isOverdue } from '@/components/meal/mealUi';
import GanttChart from '@/components/meal/project/GanttChart';

const STATUSES: ActivityStatus[] = ['PLANNED', 'IN_PROGRESS', 'DONE', 'DELAYED', 'CANCELLED'];
const empty = { title: '', indicatorId: '', assigneeId: '', startDate: '', dueDate: '', location: '', description: '' };

export default function WorkplanTab({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [filter, setFilter] = useState<'all' | ActivityStatus>('all');
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [linking, setLinking] = useState<Activity | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ['meal-members', project.id],
    queryFn: async () => (await api.get<User[]>(`/meal/projects/${project.id}/members`)).data,
  });

  const activities = project.activities ?? [];
  const shown = filter === 'all' ? activities : activities.filter((a) => a.status === filter);
  const done = activities.filter((a) => a.status === 'DONE').length;
  const overall = activities.length ? Math.round((done / activities.length) * 100) : 0;
  const overdueCount = activities.filter(isOverdue).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/activities`, {
      title: f.title,
      description: f.description || undefined,
      indicatorId: f.indicatorId || undefined,
      assigneeId: f.assigneeId || undefined,
      startDate: f.startDate || undefined,
      dueDate: f.dueDate || undefined,
      location: f.location || undefined,
    });
    setF(empty);
    setOpen(false);
    reload();
  }

  async function patch(id: string, data: Partial<Activity>) {
    await api.patch(`/meal/activities/${id}`, data);
    reload();
  }

  async function remove(a: Activity) {
    const ok = await dialog.confirm({ title: 'Supprimer l’activité', message: `« ${a.title} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/activities/${a.id}`);
      reload();
    }
  }

  async function toggleCalendar(a: Activity) {
    setSyncing(a.id);
    try {
      if (a.calendarEventId) {
        await api.delete(`/meal/activities/${a.id}/sync-calendar`);
      } else {
        await api.post(`/meal/activities/${a.id}/sync-calendar`);
      }
      reload();
    } finally {
      setSyncing(null);
    }
  }

  async function unlinkCard(a: Activity) {
    setUnlinking(a.id);
    try {
      await api.delete(`/meal/activities/${a.id}/link-card`);
      reload();
    } finally {
      setUnlinking(null);
    }
  }

  async function syncAllDated() {
    const targets = activities.filter((a) => (a.startDate || a.dueDate) && !a.calendarEventId);
    if (targets.length === 0) return;
    setSyncingAll(true);
    try {
      for (const a of targets) await api.post(`/meal/activities/${a.id}/sync-calendar`);
      reload();
    } finally {
      setSyncingAll(false);
    }
  }

  const indicatorOpts = (project.indicators ?? []).map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));
  const memberOpts = [{ value: '', label: 'Non assignée' }, ...(members.data ?? []).map((u) => ({ value: u.id, label: u.fullName }))];

  return (
    <div className="space-y-4">
      <SectionHeading
        icon={IconCalendar}
        tone="sky"
        title="Planification — plan de travail"
        subtitle={
          <>
            {done}/{activities.length} activité(s) terminée(s) — {overall}%
            {overdueCount > 0 && <span className="ml-2 font-semibold text-red-500">· {overdueCount} en retard</span>}
          </>
        }
        action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--outline)] p-0.5">
            {(
              [
                ['list', 'Liste', IconList],
                ['timeline', 'Chronologie', IconCalendar],
              ] as const
            ).map(([v, lbl, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                title={lbl}
                aria-pressed={view === v}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                  view === v ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
          </div>
          <button
            className="btn-outlined btn-sm"
            onClick={syncAllDated}
            disabled={syncingAll || !activities.some((a) => (a.startDate || a.dueDate) && !a.calendarEventId)}
            title="Aligner les échéances datees avec votre agenda"
          >
            <IconCalendar className="h-4 w-4" /> {syncingAll ? 'Synchronisation…' : 'Synchroniser l’agenda'}
          </button>
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Activité
          </button>
        </div>
        }
      />

      {activities.length > 0 && <Bar pct={overall} tone={overall >= 90 ? 'emerald' : overall >= 50 ? 'accent' : 'amber'} />}

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Intitule de l'activité" className="sm:col-span-4">
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </Field>
          <Field label="Indicateur lie" className="sm:col-span-2">
            <Select value={f.indicatorId} onChange={(v) => setF({ ...f, indicatorId: v })} placeholder="Aucun" options={[{ value: '', label: 'Aucun' }, ...indicatorOpts]} />
          </Field>
          <Field label="Responsable" className="sm:col-span-2">
            <Select value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} options={memberOpts} />
          </Field>
          <Field label="Debut" className="sm:col-span-1">
            <input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </Field>
          <Field label="Échéance" className="sm:col-span-1">
            <input className="input" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="Lieu" className="sm:col-span-2">
            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <button className="btn-primary sm:col-span-4 sm:w-40">Ajouter</button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              'rounded-full px-2.5 py-1 text-2xs font-semibold transition ' +
              (filter === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]')
            }
          >
            {s === 'all' ? 'Toutes' : ACTIVITY_STATUS[s].label}
          </button>
        ))}
      </div>

      {view === 'timeline' ? (
        <GanttChart activities={shown} />
      ) : (
      <div className="space-y-2">
        {shown.map((a) => {
          const overdue = isOverdue(a);
          return (
            <div key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{a.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--text-dim)]">
                    {a.assignee && <span>👤 {a.assignee.fullName}</span>}
                    {a.dueDate && (
                      <span className={overdue ? 'font-semibold text-red-500' : ''}>
                        Échéance {new Date(a.dueDate).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                    {a.location && <span>📍 {a.location}</span>}
                    {a.card && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent-strong)]">
                        <IconKanban className="h-3 w-3" /> {a.card.title}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    className="w-36"
                    value={a.status}
                    onChange={(v) => patch(a.id, { status: v as ActivityStatus, ...(v === 'DONE' ? { progress: 100 } : {}) })}
                    options={STATUSES.map((s) => ({ value: s, label: ACTIVITY_STATUS[s].label }))}
                  />
                  <button
                    className={clsx('icon-btn-sm', a.card && 'text-[var(--accent-strong)]')}
                    title={
                      a.card
                        ? `Liée à la tâche « ${a.card.title} » (${a.card.column.board.name}) — cliquer pour délier`
                        : 'Lier une tâche du Projet / Kanban'
                    }
                    disabled={unlinking === a.id}
                    onClick={() => (a.card ? unlinkCard(a) : setLinking(a))}
                  >
                    {a.card ? <IconUnlink className="h-4 w-4" /> : <IconLink className="h-4 w-4" />}
                  </button>
                  {(a.startDate || a.dueDate) && (
                    <button
                      className={clsx(
                        'icon-btn-sm relative',
                        a.calendarEventId && 'text-[var(--accent-strong)]',
                      )}
                      title={a.calendarEventId ? 'Retirer de l’agenda' : 'Ajouter a l’agenda'}
                      disabled={syncing === a.id}
                      onClick={() => toggleCalendar(a)}
                    >
                      <IconCalendar className="h-4 w-4" />
                      {a.calendarEventId && (
                        <IconCheck className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--surface)]" />
                      )}
                    </button>
                  )}
                  <button className="icon-btn-sm text-red-500" title="Supprimer" onClick={() => remove(a)}>
                    <IconDelete className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={a.progress}
                  onChange={(e) => patch(a.id, { progress: Number(e.target.value) })}
                  className="h-1 flex-1 accent-[var(--accent)]"
                />
                <span className="w-10 text-right text-2xs text-[var(--text-dim)]">{a.progress}%</span>
                <Badge className={ACTIVITY_STATUS[a.status].cls}>{ACTIVITY_STATUS[a.status].label}</Badge>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <EmptyState
            icon={<IconCalendar className="h-7 w-7" />}
            title={`Aucune activité${filter !== 'all' ? ' dans ce statut' : ''}`}
            hint={filter === 'all' ? 'Ajoutez la première activité du plan de travail.' : undefined}
          />
        )}
      </div>
      )}

      {linking && (
        <LinkCardModal
          activity={linking}
          workspaceId={project.workspaceId}
          onClose={() => setLinking(null)}
          onDone={() => {
            setLinking(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function LinkCardModal({
  activity,
  workspaceId,
  onClose,
  onDone,
}: {
  activity: Activity;
  workspaceId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [boardId, setBoardId] = useState('');
  const [cardId, setCardId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const boards = useQuery({
    queryKey: ['meal-link-boards', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => (await api.get<Board[]>('/boards', { params: { workspaceId } })).data,
  });
  const boardDetail = useQuery({
    queryKey: ['meal-link-board-detail', boardId],
    enabled: !!boardId,
    queryFn: async () => (await api.get<Board>(`/boards/${boardId}`)).data,
  });

  const cardOpts = (boardDetail.data?.columns ?? []).flatMap((c) =>
    c.cards.map((card) => ({ value: card.id, label: `${card.title} — ${c.name}` })),
  );

  async function submit() {
    if (!cardId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/meal/activities/${activity.id}/link-card`, { cardId });
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Impossible de lier cette tâche.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Lier une tâche"
      size="sm"
      footer={
        <>
          <button className="btn-text" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !cardId}>
            {busy ? 'Liaison…' : 'Lier'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-dim)]">
          Rattachez « {activity.title} » à une tâche existante du module Projet / Kanban. Le statut de la tâche
          pilotera ensuite automatiquement le statut de cette activité.
        </p>
        <Field label="Tableau (Projet Kanban)">
          <Select
            value={boardId}
            onChange={(v) => {
              setBoardId(v);
              setCardId('');
            }}
            placeholder="Choisir un tableau"
            options={(boards.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Field label="Tâche">
          <Select
            value={cardId}
            onChange={setCardId}
            placeholder={boardId ? 'Choisir une tâche' : 'Choisissez d’abord un tableau'}
            options={cardOpts}
          />
        </Field>
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
