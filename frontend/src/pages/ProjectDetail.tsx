import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Indicator, Project } from '@/lib/types';
import { IconBack } from '@/lib/icons';

const LEVELS: Indicator['level'][] = ['IMPACT', 'OUTCOME', 'OUTPUT', 'ACTIVITY'];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [showInd, setShowInd] = useState(false);
  const [ind, setInd] = useState({ code: '', name: '', level: 'OUTCOME', unit: '', baseline: '', target: '' });

  const project = useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => (await api.get<Project>(`/meal/projects/${projectId}`)).data,
  });

  async function addIndicator(e: FormEvent) {
    e.preventDefault();
    await api.post(`/meal/projects/${projectId}/indicators`, {
      code: ind.code,
      name: ind.name,
      level: ind.level,
      unit: ind.unit || undefined,
      baseline: ind.baseline ? Number(ind.baseline) : undefined,
      target: ind.target ? Number(ind.target) : undefined,
    });
    setInd({ code: '', name: '', level: 'OUTCOME', unit: '', baseline: '', target: '' });
    setShowInd(false);
    project.refetch();
  }

  async function addMeasurement(indicatorId: string, value: number, start: string, end: string) {
    await api.post(`/meal/indicators/${indicatorId}/measurements`, {
      value,
      periodStart: start,
      periodEnd: end,
    });
    project.refetch();
  }

  if (project.isLoading) return <div className="p-6 text-slate-400">Chargement…</div>;
  if (!project.data) return <div className="p-6">Projet introuvable</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Link to="/meal" className="icon-btn" aria-label="Retour a MEAL">
          <IconBack className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-normal sm:text-[22px] text-slate-800 dark:text-slate-100">{project.data.name}</h1>
      </div>
      <p className="text-slate-500">
        {project.data.code} {project.data.donor && `· Bailleur: ${project.data.donor}`}
      </p>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cadre logique & indicateurs</h2>
        <button className="btn-ghost" onClick={() => setShowInd((v) => !v)}>
          + Indicateur
        </button>
      </div>

      {showInd && (
        <form onSubmit={addIndicator} className="card grid gap-3 sm:grid-cols-3">
          <input className="input" placeholder="Code" value={ind.code} onChange={(e) => setInd({ ...ind, code: e.target.value })} required />
          <input
            className="input sm:col-span-2"
            placeholder="Libelle de l'indicateur"
            value={ind.name}
            onChange={(e) => setInd({ ...ind, name: e.target.value })}
            required
          />
          <select className="input" value={ind.level} onChange={(e) => setInd({ ...ind, level: e.target.value })}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <input className="input" placeholder="Unite" value={ind.unit} onChange={(e) => setInd({ ...ind, unit: e.target.value })} />
          <input
            className="input"
            type="number"
            placeholder="Cible"
            value={ind.target}
            onChange={(e) => setInd({ ...ind, target: e.target.value })}
          />
          <button className="btn-primary sm:col-span-3 sm:w-32">Ajouter</button>
        </form>
      )}

      <div className="space-y-4">
        {LEVELS.map((level) => {
          const items = project.data!.indicators?.filter((i) => i.level === level) ?? [];
          if (!items.length) return null;
          return (
            <div key={level}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{level}</h3>
              <div className="space-y-3">
                {items.map((i) => (
                  <IndicatorRow key={i.id} indicator={i} onMeasure={addMeasurement} />
                ))}
              </div>
            </div>
          );
        })}
        {project.data.indicators?.length === 0 && <p className="text-slate-400">Aucun indicateur defini.</p>}
      </div>
    </div>
  );
}

function IndicatorRow({
  indicator,
  onMeasure,
}: {
  indicator: Indicator;
  onMeasure: (id: string, value: number, start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [m, setM] = useState({ value: '', start: today, end: today });
  const pct = Math.min(100, Math.max(0, indicator.progress ?? 0));

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">
            <span className="text-slate-400">{indicator.code}</span> — {indicator.name}
          </div>
          <div className="text-xs text-slate-500">
            Realise: {indicator.achieved ?? 0}
            {indicator.target != null && ` / ${indicator.target}`} {indicator.unit}
          </div>
        </div>
        <button className="btn-text h-8 text-xs" onClick={() => setOpen((v) => !v)}>
          + Mesure
        </button>
      </div>

      {indicator.target != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      {open && (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onMeasure(indicator.id, Number(m.value), m.start, m.end);
            setM({ value: '', start: today, end: today });
            setOpen(false);
          }}
        >
          <input
            className="input w-28"
            type="number"
            placeholder="Valeur"
            value={m.value}
            onChange={(e) => setM({ ...m, value: e.target.value })}
            required
          />
          <input className="input w-40" type="date" value={m.start} onChange={(e) => setM({ ...m, start: e.target.value })} />
          <input className="input w-40" type="date" value={m.end} onChange={(e) => setM({ ...m, end: e.target.value })} />
          <button className="btn-primary">Enregistrer</button>
        </form>
      )}

      {!!indicator.measurements?.length && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {indicator.measurements.map((ms) => (
            <li key={ms.id}>
              {new Date(ms.periodStart).toLocaleDateString()} → {new Date(ms.periodEnd).toLocaleDateString()} :{' '}
              <span className="font-medium text-slate-700">{ms.value}</span>
              {ms.location && ` · ${ms.location}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
