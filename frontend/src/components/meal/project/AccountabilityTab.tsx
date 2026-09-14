import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedbackEntry, FeedbackStatus, FeedbackType, Project, Risk, RiskStatus, User } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import { IconAdd, IconDelete, IconShield, IconError } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { Badge, FEEDBACK_STATUS, FEEDBACK_TYPE, Field, RISK_STATUS, SectionHeading, riskScore } from '@/components/meal/mealUi';

const F_TYPES: FeedbackType[] = ['COMPLAINT', 'SUGGESTION', 'QUESTION', 'APPRECIATION'];
const F_STATUS: FeedbackStatus[] = ['NEW', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];
const R_STATUS: RiskStatus[] = ['OPEN', 'MITIGATED', 'CLOSED'];

export default function AccountabilityTab({ project, reload }: { project: Project; reload: () => void }) {
  const members = useQuery({
    queryKey: ['meal-members', project.id],
    queryFn: async () => (await api.get<User[]>(`/meal/projects/${project.id}/members`)).data,
  });
  return (
    <div className="space-y-8">
      <FeedbackSection project={project} reload={reload} />
      <RiskSection project={project} reload={reload} members={members.data ?? []} />
    </div>
  );
}

// ---------------------------------------------------------------- Feedback
const fEmpty = { type: 'COMPLAINT' as FeedbackType, channel: '', category: '', summary: '', detail: '', reporter: '', location: '', sensitive: false };

function FeedbackSection({ project, reload }: { project: Project; reload: () => void }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(fEmpty);
  const list = project.feedback ?? [];
  const openCount = list.filter((e) => e.status === 'NEW' || e.status === 'IN_REVIEW').length;

  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/feedback`, {
      type: f.type,
      channel: f.channel || undefined,
      category: f.category || undefined,
      summary: f.summary,
      detail: f.detail || undefined,
      reporter: f.reporter || undefined,
      location: f.location || undefined,
      sensitive: f.sensitive,
    });
    setF(fEmpty);
    setOpen(false);
    reload();
  }
  async function patch(id: string, data: Partial<FeedbackEntry>) {
    await api.patch(`/meal/feedback/${id}`, data);
    reload();
  }
  async function remove(e: FeedbackEntry) {
    const ok = await dialog.confirm({ title: 'Supprimer le retour', message: `« ${e.summary} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/feedback/${e.id}`);
      reload();
    }
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        icon={IconShield}
        tone="amber"
        title="Retours & plaintes des communautés"
        subtitle={`${openCount} en attente sur ${list.length}`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Retour
          </button>
        }
      />

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Type">
            <Select value={f.type} onChange={(v) => setF({ ...f, type: v as FeedbackType })} options={F_TYPES.map((t) => ({ value: t, label: FEEDBACK_TYPE[t] }))} />
          </Field>
          <Field label="Canal de reception">
            <input className="input" placeholder="Ligne verte, boite…" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} />
          </Field>
          <Field label="Catégorie">
            <input className="input" placeholder="Ciblage, conduite…" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Field>
          <Field label="Lieu">
            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          </Field>
          <Field label="Résumé" className="sm:col-span-4">
            <input className="input" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} required />
          </Field>
          <Field label="Detail" className="sm:col-span-4">
            <textarea className="input" rows={2} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
          </Field>
          <Field label="Rapporteur (laisser vide = anonyme)" className="sm:col-span-2">
            <input className="input" value={f.reporter} onChange={(e) => setF({ ...f, reporter: e.target.value })} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={f.sensitive} onChange={(e) => setF({ ...f, sensitive: e.target.checked })} />
            Cas sensible (accès restreint)
          </label>
          <button className="btn-primary sm:col-span-4 sm:w-40">Enregistrer</button>
        </form>
      )}

      <div className="space-y-2">
        {list.map((e) => (
          <div key={e.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-[var(--surface-2)] text-[var(--text-dim)]">{FEEDBACK_TYPE[e.type]}</Badge>
                  {e.sensitive && <Badge className="bg-red-500/15 text-red-600 dark:text-red-400">Sensible</Badge>}
                  <span className="font-medium">{e.summary}</span>
                </div>
                <div className="mt-0.5 text-2xs text-[var(--text-dim)]">
                  {new Date(e.receivedAt).toLocaleDateString('fr-FR')}
                  {e.channel && ` · ${e.channel}`}
                  {e.category && ` · ${e.category}`}
                  {e.location && ` · ${e.location}`}
                  {` · ${e.reporter || 'anonyme'}`}
                </div>
                {e.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-dim)]">{e.detail}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Select
                  className="w-40"
                  value={e.status}
                  onChange={(v) => patch(e.id, { status: v as FeedbackStatus })}
                  options={F_STATUS.map((s) => ({ value: s, label: FEEDBACK_STATUS[s].label }))}
                />
                <button className="icon-btn-sm text-red-500" onClick={() => remove(e)} title="Supprimer">
                  <IconDelete className="h-4 w-4" />
                </button>
              </div>
            </div>
            {(e.status === 'RESOLVED' || e.status === 'CLOSED' || e.resolution) && (
              <input
                className="input mt-2 h-9"
                placeholder="Suite donnée / réponse apportee…"
                defaultValue={e.resolution ?? ''}
                onBlur={(ev) => ev.target.value !== (e.resolution ?? '') && patch(e.id, { resolution: ev.target.value })}
              />
            )}
          </div>
        ))}
        {list.length === 0 && (
          <EmptyState icon={<IconShield className="h-7 w-7" />} title="Aucun retour enregistré" />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Risks
const rEmpty = { title: '', description: '', likelihood: 3, impact: 3, mitigation: '', ownerId: '' };

function RiskSection({ project, reload, members }: { project: Project; reload: () => void; members: User[] }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(rEmpty);
  const list = project.risks ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/risks`, {
      title: f.title,
      description: f.description || undefined,
      likelihood: f.likelihood,
      impact: f.impact,
      mitigation: f.mitigation || undefined,
      ownerId: f.ownerId || undefined,
    });
    setF(rEmpty);
    setOpen(false);
    reload();
  }
  async function patch(id: string, data: Partial<Risk>) {
    await api.patch(`/meal/risks/${id}`, data);
    reload();
  }
  async function remove(r: Risk) {
    const ok = await dialog.confirm({ title: 'Supprimer le risque', message: `« ${r.title} »`, danger: true, confirmLabel: 'Supprimer' });
    if (ok) {
      await api.delete(`/meal/risks/${r.id}`);
      reload();
    }
  }

  const scale = [1, 2, 3, 4, 5];
  const memberOpts = [{ value: '', label: 'Sans responsable' }, ...members.map((u) => ({ value: u.id, label: u.fullName }))];

  return (
    <section className="space-y-3">
      <SectionHeading
        icon={IconError}
        tone="red"
        title="Registre des risques"
        subtitle={`${list.filter((r) => r.status === 'OPEN').length} ouvert(s) sur ${list.length}`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Risque
          </button>
        }
      />

      {open && (
        <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4">
          <Field label="Intitule du risque" className="sm:col-span-4">
            <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </Field>
          <Field label="Probabilite (1-5)">
            <Select value={String(f.likelihood)} onChange={(v) => setF({ ...f, likelihood: Number(v) })} options={scale.map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
          <Field label="Impact (1-5)">
            <Select value={String(f.impact)} onChange={(v) => setF({ ...f, impact: Number(v) })} options={scale.map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
          <Field label="Responsable" className="sm:col-span-2">
            <Select value={f.ownerId} onChange={(v) => setF({ ...f, ownerId: v })} options={memberOpts} />
          </Field>
          <Field label="Mesure d'atténuation" className="sm:col-span-4">
            <textarea className="input" rows={2} value={f.mitigation} onChange={(e) => setF({ ...f, mitigation: e.target.value })} />
          </Field>
          <button className="btn-primary sm:col-span-4 sm:w-40">Ajouter</button>
        </form>
      )}

      <div className="space-y-2">
        {list.map((r) => {
          const sc = riskScore(r.likelihood, r.impact);
          return (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={sc.cls}>{sc.label} · {r.likelihood}×{r.impact}</Badge>
                    <Badge className={RISK_STATUS[r.status].cls}>{RISK_STATUS[r.status].label}</Badge>
                    <span className="font-medium">{r.title}</span>
                  </div>
                  {r.mitigation && <p className="mt-1 text-sm text-[var(--text-dim)]">Atténuation : {r.mitigation}</p>}
                  {r.owner && <p className="mt-0.5 text-2xs text-[var(--text-dim)]">Responsable : {r.owner.fullName}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    className="w-32"
                    value={r.status}
                    onChange={(v) => patch(r.id, { status: v as RiskStatus })}
                    options={R_STATUS.map((s) => ({ value: s, label: RISK_STATUS[s].label }))}
                  />
                  <button className="icon-btn-sm text-red-500" onClick={() => remove(r)} title="Supprimer">
                    <IconDelete className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <EmptyState icon={<IconError className="h-7 w-7" />} title="Aucun risque enregistré" />
        )}
      </div>
    </section>
  );
}
