import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import type { Indicator, Project } from '@/lib/types';
import { useDialog } from '@/context/DialogContext';
import Select from '@/components/Select';
import { IconAdd, IconDelete, IconEdit, IconCheck, IconTarget, IconFlag } from '@/lib/icons';
import EmptyState from '@/components/EmptyState';
import { Bar, Field, LEVELS, LEVEL_LABEL, LEVEL_SHORT, SectionHeading, periodOptions } from '@/components/meal/mealUi';

export default function LogframeTab({ project, reload }: { project: Project; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [ind, setInd] = useState({
    code: '',
    name: '',
    level: 'OUTCOME',
    unit: '',
    baseline: '',
    target: '',
    meansOfVerification: '',
    assumptions: '',
  });

  async function addIndicator(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${project.id}/indicators`, {
      code: ind.code,
      name: ind.name,
      level: ind.level,
      unit: ind.unit || undefined,
      baseline: ind.baseline ? Number(ind.baseline) : undefined,
      target: ind.target ? Number(ind.target) : undefined,
      meansOfVerification: ind.meansOfVerification || undefined,
      assumptions: ind.assumptions || undefined,
    });
    setInd({ code: '', name: '', level: 'OUTCOME', unit: '', baseline: '', target: '', meansOfVerification: '', assumptions: '' });
    setOpen(false);
    reload();
  }

  const indicators = project.indicators ?? [];

  async function saveGoal(goal: string) {
    if (goal === (project.goal ?? '')) return;
    await api.patch(`/meal/projects/${project.id}`, { goal: goal || null });
    reload();
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        icon={IconFlag}
        tone="violet"
        title="Conception — modèles logiques"
        subtitle="Théorie du changement, cadre de résultats et cadre logique : comment le changement va se produire, et comment il sera mesure."
      />

      <div className="card">
        <Field label="Théorie du changement (ToC)">
          <textarea
            className="input"
            rows={3}
            placeholder="Si… alors… parce que… — décrivez le changement visé, les hypothèses cles et la logique causale du projet."
            defaultValue={project.goal ?? ''}
            onBlur={(e) => saveGoal(e.target.value.trim())}
          />
        </Field>
        <p className="mt-1 text-2xs text-[var(--text-dim)]">
          Enregistré automatiquement. Le cadre de résultats (hiérarchie Impact → Résultat → Produit → Activité)
          et le cadre logique ci-dessous en decoulent.
        </p>
      </div>

      <SectionHeading
        icon={IconTarget}
        tone="violet"
        title="Cadre de résultats & cadre logique"
        subtitle={`${indicators.length} indicateur(s) — hiérarchie Impact → Résultat → Produit → Activité.`}
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen((v) => !v)}>
            <IconAdd className="h-4 w-4" /> Indicateur
          </button>
        }
      />

      {open && (
        <form onSubmit={addIndicator} className="card grid gap-3 sm:grid-cols-6">
          <Field label="Code" className="sm:col-span-1">
            <input className="input" value={ind.code} onChange={(e) => setInd({ ...ind, code: e.target.value })} required />
          </Field>
          <Field label="Libellé de l'indicateur" className="sm:col-span-5">
            <input className="input" value={ind.name} onChange={(e) => setInd({ ...ind, name: e.target.value })} required />
          </Field>
          <Field label="Niveau du cadre logique" className="sm:col-span-3">
            <Select
              value={ind.level}
              onChange={(level) => setInd({ ...ind, level })}
              options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] }))}
            />
          </Field>
          <Field label="Unite" className="sm:col-span-1">
            <input className="input" placeholder="pers." value={ind.unit} onChange={(e) => setInd({ ...ind, unit: e.target.value })} />
          </Field>
          <Field label="Référence (baseline)" className="sm:col-span-1">
            <input className="input" type="number" value={ind.baseline} onChange={(e) => setInd({ ...ind, baseline: e.target.value })} />
          </Field>
          <Field label="Cible finale" className="sm:col-span-1">
            <input className="input" type="number" value={ind.target} onChange={(e) => setInd({ ...ind, target: e.target.value })} />
          </Field>
          <Field label="Moyens de vérification" className="sm:col-span-3">
            <input
              className="input"
              placeholder="Rapports de distribution, registres…"
              value={ind.meansOfVerification}
              onChange={(e) => setInd({ ...ind, meansOfVerification: e.target.value })}
            />
          </Field>
          <Field label="Hypothèses / risques" className="sm:col-span-3">
            <input
              className="input"
              value={ind.assumptions}
              onChange={(e) => setInd({ ...ind, assumptions: e.target.value })}
            />
          </Field>
          <button className="btn-primary sm:col-span-6 sm:w-40">Ajouter</button>
        </form>
      )}

      {LEVELS.map((level) => {
        const items = indicators.filter((i) => i.level === level);
        if (!items.length) return null;
        return (
          <div key={level}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              <span className="h-1.5 w-4 rounded-full bg-[var(--accent)]" />
              {LEVEL_SHORT[level]}
              <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-bold">
                {items.length}
              </span>
            </h3>
            <div className="space-y-3">
              {items.map((i) => (
                <IndicatorCard key={i.id} indicator={i} reload={reload} />
              ))}
            </div>
          </div>
        );
      })}
      {indicators.length === 0 && (
        <EmptyState
          icon={<IconTarget className="h-7 w-7" />}
          title="Aucun indicateur"
          hint="Ajoutez la première ligne du cadre logique pour commencer a suivre les résultats du projet."
        />
      )}
    </div>
  );
}

function IndicatorCard({ indicator, reload }: { indicator: Indicator; reload: () => void }) {
  const dialog = useDialog();
  const [tab, setTab] = useState<'measure' | 'target' | null>(null);
  const [edit, setEdit] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [m, setM] = useState({ value: '', start: today, end: today, location: '', female: '', male: '', youth: '', disability: '', source: '' });
  const [tg, setTg] = useState({ period: periodOptions()[1]?.value ?? '', target: '' });
  const [ed, setEd] = useState({ name: indicator.name, target: indicator.target?.toString() ?? '', unit: indicator.unit ?? '', assumptions: indicator.assumptions ?? '' });

  const pct = Math.min(100, Math.max(0, indicator.progress ?? 0));
  const d = indicator.disagg;

  async function addMeasure(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/indicators/${indicator.id}/measurements`, {
      value: Number(m.value),
      periodStart: m.start,
      periodEnd: m.end,
      location: m.location || undefined,
      source: m.source || undefined,
      female: m.female ? Number(m.female) : undefined,
      male: m.male ? Number(m.male) : undefined,
      youth: m.youth ? Number(m.youth) : undefined,
      disability: m.disability ? Number(m.disability) : undefined,
    });
    setM({ value: '', start: today, end: today, location: '', female: '', male: '', youth: '', disability: '', source: '' });
    setTab(null);
    reload();
  }

  async function saveTarget(e: FormEvent) {
    e.preventDefault();
    if (!tg.period || tg.target === '') return;
    await api.put(`/meal/indicators/${indicator.id}/targets`, { period: tg.period, target: Number(tg.target) });
    setTg({ ...tg, target: '' });
    setTab(null);
    reload();
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/meal/indicators/${indicator.id}`, {
      name: ed.name,
      target: ed.target ? Number(ed.target) : null,
      unit: ed.unit || null,
      assumptions: ed.assumptions || null,
    });
    setEdit(false);
    reload();
  }

  async function removeIndicator() {
    const ok = await dialog.confirm({
      title: 'Supprimer l’indicateur',
      message: `« ${indicator.code} — ${indicator.name} » et toutes ses mesures seront supprimes.`,
      danger: true,
      confirmLabel: 'Supprimer',
    });
    if (ok) {
      await api.delete(`/meal/indicators/${indicator.id}`);
      reload();
    }
  }

  async function toggleVerified(id: string, verified: boolean) {
    await api.patch(`/meal/measurements/${id}`, { verified });
    reload();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            <span className="text-[var(--text-dim)]">{indicator.code}</span> — {indicator.name}
          </div>
          <div className="text-xs text-[var(--text-dim)]">
            Réalisé : <span className="font-medium text-[var(--text)]">{indicator.achieved ?? 0}</span>
            {indicator.target != null && ` / ${indicator.target}`} {indicator.unit}
            {indicator.baseline != null && ` · référence ${indicator.baseline}`}
            {indicator.progress != null && ` · ${indicator.progress}%`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="btn-text btn-sm" onClick={() => setTab(tab === 'target' ? null : 'target')}>
            Cibles
          </button>
          <button className="btn-outlined btn-sm" onClick={() => setTab(tab === 'measure' ? null : 'measure')}>
            <IconAdd className="h-4 w-4" /> Mesure
          </button>
          <button className="icon-btn-sm" title="Modifier" onClick={() => setEdit((v) => !v)}>
            <IconEdit className="h-4 w-4" />
          </button>
          <button className="icon-btn-sm text-red-500" title="Supprimer" onClick={removeIndicator}>
            <IconDelete className="h-4 w-4" />
          </button>
        </div>
      </div>

      {indicator.target != null && <div className="mt-2"><Bar pct={pct} tone={pct >= 90 ? 'emerald' : pct >= 50 ? 'accent' : 'amber'} /></div>}

      {d && (d.female || d.male || d.youth || d.disability) ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-2xs text-[var(--text-dim)]">
          {!!d.female && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">Femmes : {d.female}</span>}
          {!!d.male && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">Hommes : {d.male}</span>}
          {!!d.youth && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">Jeunes : {d.youth}</span>}
          {!!d.disability && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5">Situation de handicap : {d.disability}</span>}
        </div>
      ) : null}

      {indicator.meansOfVerification && (
        <p className="mt-2 text-2xs text-[var(--text-dim)]">Vérification : {indicator.meansOfVerification}</p>
      )}

      {edit && (
        <form onSubmit={saveEdit} className="mt-3 grid gap-2 rounded-lg bg-[var(--surface-2)] p-3 sm:grid-cols-4">
          <input className="input sm:col-span-2" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} />
          <input className="input" type="number" placeholder="Cible" value={ed.target} onChange={(e) => setEd({ ...ed, target: e.target.value })} />
          <input className="input" placeholder="Unite" value={ed.unit} onChange={(e) => setEd({ ...ed, unit: e.target.value })} />
          <input className="input sm:col-span-3" placeholder="Hypothèses" value={ed.assumptions} onChange={(e) => setEd({ ...ed, assumptions: e.target.value })} />
          <button className="btn-primary btn-sm">Enregistrer</button>
        </form>
      )}

      {tab === 'target' && (
        <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3">
          <form onSubmit={saveTarget} className="flex flex-wrap items-end gap-2">
            <Field label="Période">
              <Select
                className="w-40"
                value={tg.period}
                onChange={(period) => setTg({ ...tg, period })}
                options={periodOptions()}
              />
            </Field>
            <Field label="Cible">
              <input className="input w-28" type="number" value={tg.target} onChange={(e) => setTg({ ...tg, target: e.target.value })} required />
            </Field>
            <button className="btn-primary btn-sm">Definir</button>
          </form>
          {!!indicator.targets?.length && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {indicator.targets.map((t) => (
                <li key={t.id} className="flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-2xs">
                  <span className="font-semibold">{t.period}</span> : {t.target}
                  <button
                    className="text-[var(--text-dim)] hover:text-red-500"
                    onClick={async () => {
                      await api.delete(`/meal/targets/${t.id}`);
                      reload();
                    }}
                  >
                    <IconDelete className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'measure' && (
        <form onSubmit={addMeasure} className="mt-3 grid gap-2 rounded-lg bg-[var(--surface-2)] p-3 sm:grid-cols-4">
          <input className="input" type="number" placeholder="Valeur totale" value={m.value} onChange={(e) => setM({ ...m, value: e.target.value })} required />
          <input className="input" type="date" value={m.start} onChange={(e) => setM({ ...m, start: e.target.value })} />
          <input className="input" type="date" value={m.end} onChange={(e) => setM({ ...m, end: e.target.value })} />
          <input className="input" placeholder="Lieu" value={m.location} onChange={(e) => setM({ ...m, location: e.target.value })} />
          <input className="input" type="number" placeholder="dont femmes" value={m.female} onChange={(e) => setM({ ...m, female: e.target.value })} />
          <input className="input" type="number" placeholder="dont hommes" value={m.male} onChange={(e) => setM({ ...m, male: e.target.value })} />
          <input className="input" type="number" placeholder="dont jeunes" value={m.youth} onChange={(e) => setM({ ...m, youth: e.target.value })} />
          <input className="input" type="number" placeholder="dont handicap" value={m.disability} onChange={(e) => setM({ ...m, disability: e.target.value })} />
          <input className="input sm:col-span-3" placeholder="Source de la donnée" value={m.source} onChange={(e) => setM({ ...m, source: e.target.value })} />
          <button className="btn-primary btn-sm">Enregistrer</button>
        </form>
      )}

      {!!indicator.measurements?.length && (
        <ul className="mt-3 space-y-1 text-xs">
          {indicator.measurements.map((ms) => (
            <li key={ms.id} className="flex items-center gap-2 text-[var(--text-dim)]">
              <button
                className={
                  'grid h-4 w-4 shrink-0 place-items-center rounded border ' +
                  (ms.verified
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-[var(--outline)] text-transparent hover:border-[var(--accent)]')
                }
                title={ms.verified ? 'Donnée vérifiée' : 'Marquer comme vérifiée'}
                onClick={() => toggleVerified(ms.id, !ms.verified)}
              >
                <IconCheck className="h-3 w-3" />
              </button>
              {new Date(ms.periodStart).toLocaleDateString('fr-FR')} → {new Date(ms.periodEnd).toLocaleDateString('fr-FR')} :{' '}
              <span className="font-medium text-[var(--text)]">{ms.value}</span>
              {ms.location && ` · ${ms.location}`}
              {ms.source && ` · ${ms.source}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
