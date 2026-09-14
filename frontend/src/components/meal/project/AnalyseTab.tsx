import { useMemo, useState } from 'react';
import type { Indicator, LogframeLevel, Measurement, Project } from '@/lib/types';
import { IconAnalytics, IconCheck, IconTrending, IconTarget, IconSearch, IconError, IconClose } from '@/lib/icons';
import { Bar, KpiTile, SectionHeading, inPeriod, LEVELS, LEVEL_SHORT } from '@/components/meal/mealUi';

/**
 * Phase 4 — Analyse : le projet a déjà collecte ses données (phase 3), cet
 * onglet les interprète — tendance par indicateur, qualité des données
 * (vérification), prévu vs réalisé par période — pour alimenter la phase
 * suivante (Utilisation : rapports, décisions, redevabilité).
 *
 * Tableau de bord interactif : un filtre (recherche + niveau du cadre
 * logique) recalcule en direct les KPI et les trois sections ci-dessous.
 */
export default function AnalyseTab({ project }: { project: Project }) {
  const all = project.indicators ?? [];
  const [level, setLevel] = useState<'ALL' | LogframeLevel>('ALL');
  const [q, setQ] = useState('');

  const indicators = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(
      (i) =>
        (level === 'ALL' || i.level === level) &&
        (!s || i.code.toLowerCase().includes(s) || i.name.toLowerCase().includes(s)),
    );
  }, [all, level, q]);
  const hasFilter = level !== 'ALL' || q.trim() !== '';

  const withMeasurements = indicators.filter((i) => (i.measurements?.length ?? 0) > 0);
  const withTargets = indicators.filter((i) => (i.targets?.length ?? 0) > 0);

  const dqa = useMemo(() => {
    let verified = 0;
    let total = 0;
    for (const i of indicators) {
      for (const m of i.measurements ?? []) {
        total++;
        if (m.verified) verified++;
      }
    }
    return { verified, total, pct: total ? Math.round((verified / total) * 100) : null };
  }, [indicators]);

  const avgProgress = useMemo(() => {
    const withPct = indicators.filter((i) => i.progress != null);
    if (!withPct.length) return null;
    return Math.round(withPct.reduce((s, i) => s + (i.progress ?? 0), 0) / withPct.length);
  }, [indicators]);

  const attention = indicators.filter((i) => i.progress != null && (i.progress ?? 0) < 50).length;

  return (
    <div className="space-y-6">
      <SectionHeading
        icon={IconAnalytics}
        tone="accent"
        title="Analyse des données"
        subtitle="Tableau de bord interactif : filtrez par niveau ou recherchez un indicateur pour explorer tendances, qualité et performance."
      />

      {/* --- Filtres -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            className="input pl-9"
            placeholder="Rechercher un indicateur (code ou libellé)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...LEVELS] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={
                'rounded-full px-2.5 py-1 text-2xs font-semibold transition ' +
                (level === l
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]')
              }
            >
              {l === 'ALL' ? 'Tous les niveaux' : LEVEL_SHORT[l]}
            </button>
          ))}
        </div>
        {hasFilter && (
          <button
            onClick={() => {
              setLevel('ALL');
              setQ('');
            }}
            className="flex items-center gap-1 text-2xs font-semibold text-[var(--accent-strong)] hover:underline"
          >
            <IconClose className="h-3.5 w-3.5" /> Reinitialiser
          </button>
        )}
      </div>

      {/* --- KPI -------------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={IconTarget}
          tone="accent"
          label="Indicateurs analyses"
          value={indicators.length}
          sub={`${withMeasurements.length} avec données collectées`}
        />
        <KpiTile
          icon={IconTrending}
          tone={avgProgress == null ? 'accent' : avgProgress >= 90 ? 'emerald' : avgProgress >= 50 ? 'sky' : 'amber'}
          label="Avancement moyen"
          value={avgProgress == null ? '—' : `${avgProgress}%`}
          sub={
            avgProgress != null && (
              <span className="mt-1 block max-w-xs">
                <Bar pct={avgProgress} tone={avgProgress >= 90 ? 'emerald' : avgProgress >= 50 ? 'accent' : 'amber'} />
              </span>
            )
          }
        />
        <KpiTile
          icon={IconCheck}
          tone={(dqa.pct ?? 0) >= 90 ? 'emerald' : (dqa.pct ?? 0) >= 60 ? 'accent' : 'amber'}
          label="Qualité des données"
          value={dqa.pct == null ? '—' : `${dqa.pct}%`}
          sub={`${dqa.verified}/${dqa.total} relevés vérifiés`}
        />
        <KpiTile
          icon={IconError}
          tone={attention > 0 ? 'red' : 'emerald'}
          label="Points d'attention"
          value={attention}
          sub="indicateur(s) sous 50% d'avancement"
        />
      </div>

      {hasFilter && indicators.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--outline)] py-6 text-center text-sm text-[var(--text-dim)]">
          Aucun indicateur ne correspond a ce filtre.
        </p>
      )}

      {/* --- Qualité des données (DQA) ------------------------------------ */}
      <section className="space-y-2">
        <h3 className="section-title flex items-center gap-2">
          <IconCheck className="h-4 w-4 text-[var(--text-dim)]" /> Qualité des données par indicateur
        </h3>
        {indicators.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-[var(--surface-2)] text-2xs uppercase tracking-wide text-[var(--text-dim)]">
                <tr>
                  <th className="px-3 py-2 text-left">Indicateur</th>
                  <th className="px-3 py-2 text-right">Relevés</th>
                  <th className="px-3 py-2 text-right">Vérifiés</th>
                  <th className="px-3 py-2 text-left">Taux de vérification</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((i) => {
                  const total = i.measurements?.length ?? 0;
                  const verif = (i.measurements ?? []).filter((m) => m.verified).length;
                  const pct = total ? Math.round((verif / total) * 100) : null;
                  return (
                    <tr key={i.id} className="border-t border-[var(--outline)] transition hover:bg-[var(--surface-2)]">
                      <td className="px-3 py-2">
                        <span className="text-[var(--text-dim)]">{i.code}</span> — {i.name}
                      </td>
                      <td className="px-3 py-2 text-right">{total}</td>
                      <td className="px-3 py-2 text-right">{verif}</td>
                      <td className="px-3 py-2">
                        {pct == null ? (
                          <span className="text-2xs text-[var(--text-dim)]">aucun relevé</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-24"><Bar pct={pct} tone={pct >= 90 ? 'emerald' : pct >= 60 ? 'accent' : 'amber'} /></div>
                            <span className="text-2xs font-semibold">{pct}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Tendance par indicateur --------------------------------------- */}
      <section className="space-y-2">
        <h3 className="section-title flex items-center gap-2">
          <IconTrending className="h-4 w-4 text-[var(--text-dim)]" /> Tendance des indicateurs
        </h3>
        {withMeasurements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--outline)] py-8 text-center text-sm text-[var(--text-dim)]">
            {hasFilter
              ? 'Aucun indicateur filtré n’a de donnée collectée.'
              : "Aucune donnée collectée pour l'instant (phase 3 — Collecte)."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {withMeasurements.map((i) => (
              <div key={i.id} className="card transition hover:border-[var(--accent-soft)] hover:shadow-elevation-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">
                    <span className="text-[var(--text-dim)]">{i.code}</span> — {i.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-2xs font-semibold text-[var(--text-dim)]">
                    {LEVEL_SHORT[i.level]}
                  </span>
                </div>
                <Sparkline measurements={i.measurements ?? []} target={i.target} unit={i.unit} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Prévu vs réalisé par période ----------------------------------- */}
      <section className="space-y-2">
        <h3 className="section-title flex items-center gap-2">
          <IconTarget className="h-4 w-4 text-[var(--text-dim)]" /> Cibles périodiques : prévu vs réalisé
        </h3>
        {withTargets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--outline)] py-8 text-center text-sm text-[var(--text-dim)]">
            {hasFilter
              ? 'Aucun indicateur filtré n’a de cible périodique.'
              : 'Définissez des cibles périodiques dans le cadre logique (phase 1 — Conception) pour suivre le prévu vs réalisé ici.'}
          </p>
        ) : (
          <div className="space-y-3">
            {withTargets.map((i) => (
              <div key={i.id} className="card">
                <div className="mb-2 text-sm font-semibold">
                  <span className="text-[var(--text-dim)]">{i.code}</span> — {i.name}
                </div>
                <div className="space-y-1.5">
                  {(i.targets ?? []).map((t) => {
                    const achieved = (i.measurements ?? [])
                      .filter((m) => inPeriod(t.period, m.periodStart))
                      .reduce((s, m) => s + m.value, 0);
                    const pct = t.target ? Math.round((achieved / t.target) * 100) : null;
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-2xs">
                        <span className="w-16 shrink-0 font-semibold">{t.period}</span>
                        <div className="flex-1"><Bar pct={pct ?? 0} tone={(pct ?? 0) >= 90 ? 'emerald' : (pct ?? 0) >= 50 ? 'accent' : 'amber'} /></div>
                        <span className="w-24 shrink-0 text-right text-[var(--text-dim)]">
                          {achieved} / {t.target}
                        </span>
                        <span className="w-10 shrink-0 text-right font-semibold">{pct == null ? '—' : `${pct}%`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Sparkline({
  measurements,
  target,
  unit,
}: {
  measurements: Measurement[];
  target?: Indicator['target'];
  unit?: Indicator['unit'];
}) {
  const pts = useMemo(() => {
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    );
    let running = 0;
    return sorted.map((m) => {
      running += m.value;
      return { date: new Date(m.periodStart), cum: running, value: m.value, verified: m.verified };
    });
  }, [measurements]);

  if (pts.length === 0) return <p className="text-2xs text-[var(--text-dim)]">Aucune mesure enregistrée.</p>;

  const W = 300;
  const H = 56;
  const padX = 6;
  const t0 = pts[0].date.getTime();
  const t1 = pts[pts.length - 1].date.getTime();
  const span = Math.max(1, t1 - t0);
  const last = pts[pts.length - 1];
  const maxVal = Math.max(target ?? 0, ...pts.map((p) => p.cum)) * 1.15 || 1;

  const x = (t: number) => (pts.length === 1 ? W / 2 : padX + ((t - t0) / span) * (W - padX * 2));
  const y = (v: number) => H - 4 - (v / maxVal) * (H - 8);

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date.getTime()).toFixed(1)} ${y(p.cum).toFixed(1)}`).join(' ');

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-bold text-[var(--text)]">
          {last.cum}
          {unit ? ` ${unit}` : ''}
        </span>
        {target != null && <span className="text-[var(--text-dim)]">cible : {target}{unit ? ` ${unit}` : ''}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 h-14 w-full">
        {target != null && (
          <line x1={padX} x2={W - padX} y1={y(target)} y2={y(target)} stroke="var(--outline)" strokeDasharray="3,3" strokeWidth="1" />
        )}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={x(p.date.getTime())}
            cy={y(p.cum)}
            r={i === pts.length - 1 ? 3 : 2}
            fill={p.verified ? 'var(--accent)' : 'var(--surface)'}
            stroke="var(--accent)"
            strokeWidth="1.5"
          >
            <title>
              {`${p.date.toLocaleDateString('fr-FR')} : +${p.value} (cumul ${p.cum})${p.verified ? ' · vérifié' : ' · non vérifié'}`}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-[var(--text-dim)]">
        <span>{pts[0].date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        <span>{last.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
      </div>
    </div>
  );
}
