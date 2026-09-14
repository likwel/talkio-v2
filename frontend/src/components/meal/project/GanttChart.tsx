import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { Activity } from '@/lib/types';
import { ACTIVITY_BAR_COLOR, ACTIVITY_STATUS, isOverdue } from '@/components/meal/mealUi';
import { IconPrev, IconNext, IconToday } from '@/lib/icons';

type Zoom = 'month' | 'quarter' | 'year';
const DAY = 24 * 60 * 60 * 1000;
const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];
const MONTHS_FULL_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function rangeFor(zoom: Zoom, cursor: Date): { start: Date; end: Date; label: string } {
  if (zoom === 'month') {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return { start, end: addMonths(start, 1), label: `${MONTHS_FULL_FR[start.getMonth()]} ${start.getFullYear()}` };
  }
  if (zoom === 'quarter') {
    const qm = Math.floor(cursor.getMonth() / 3) * 3;
    const start = new Date(cursor.getFullYear(), qm, 1);
    const end = addMonths(start, 3);
    return {
      start,
      end,
      label: `T${qm / 3 + 1} ${start.getFullYear()} · ${MONTHS_FR[start.getMonth()]}–${MONTHS_FR[end.getMonth() === 0 ? 11 : end.getMonth() - 1]}`,
    };
  }
  const start = new Date(cursor.getFullYear(), 0, 1);
  return { start, end: new Date(cursor.getFullYear() + 1, 0, 1), label: String(cursor.getFullYear()) };
}

function ticksFor(zoom: Zoom, start: Date, end: Date): { pos: Date; label: string; weekend?: boolean }[] {
  const out: { pos: Date; label: string; weekend?: boolean }[] = [];
  if (zoom === 'month') {
    for (let d = start; d < end; d = addDays(d, 1)) {
      const day = d.getDay();
      out.push({ pos: d, label: String(d.getDate()), weekend: day === 0 || day === 6 });
    }
  } else if (zoom === 'quarter') {
    // debut de semaine (lundi)
    let d = new Date(start);
    const dow = (d.getDay() + 6) % 7;
    d = addDays(d, -dow);
    for (; d < end; d = addDays(d, 7)) {
      out.push({ pos: d < start ? start : d, label: fmtShort(d < start ? start : d) });
    }
  } else {
    for (let m = 0; m < 12; m++) out.push({ pos: new Date(start.getFullYear(), m, 1), label: MONTHS_FR[m] });
  }
  return out;
}

const NAME_COL = 176;
const MIN_WIDTH: Record<Zoom, number> = { month: 760, quarter: 920, year: 980 };

export default function GanttChart({ activities }: { activities: Activity[] }) {
  const [zoom, setZoom] = useState<Zoom>('month');
  const [cursor, setCursor] = useState(() => new Date());

  const { start, end, label } = useMemo(() => rangeFor(zoom, cursor), [zoom, cursor]);
  const totalMs = end.getTime() - start.getTime();
  const ticks = useMemo(() => ticksFor(zoom, start, end), [zoom, start, end]);
  const today = startOfDay(new Date());
  const todayPct = today >= start && today < end ? ((today.getTime() - start.getTime()) / totalMs) * 100 : null;

  const rows = useMemo(
    () =>
      activities
        .filter((a) => a.startDate || a.dueDate)
        .map((a) => {
          const s = startOfDay(new Date(a.startDate ?? a.dueDate!));
          const e = startOfDay(new Date(a.dueDate ?? a.startDate!));
          const effEnd = e < s ? addDays(s, 1) : addDays(e, 1); // borne exclusive, largeur mini 1 jour
          const leftPct = ((s.getTime() - start.getTime()) / totalMs) * 100;
          const widthPct = ((effEnd.getTime() - s.getTime()) / totalMs) * 100;
          return { a, s, e, leftPct, widthPct };
        }),
    [activities, start, totalMs],
  );
  const withoutDates = activities.length - rows.length;

  function step(dir: 1 | -1) {
    setCursor((c) =>
      zoom === 'month' ? addMonths(c, dir) : zoom === 'quarter' ? addMonths(c, dir * 3) : addMonths(c, dir * 12),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button className="icon-btn-sm" onClick={() => step(-1)} aria-label="Precedent">
            <IconPrev className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-semibold">{label}</span>
          <button className="icon-btn-sm" onClick={() => step(1)} aria-label="Suivant">
            <IconNext className="h-4 w-4" />
          </button>
          <button className="icon-btn-sm" onClick={() => setCursor(new Date())} title="Aujourd'hui">
            <IconToday className="h-4 w-4" />
          </button>
        </div>
        <div className="flex rounded-lg border border-[var(--outline)] p-0.5 text-xs font-semibold">
          {(['month', 'quarter', 'year'] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={clsx(
                'rounded-md px-2.5 py-1 transition',
                zoom === z ? 'accent-active' : 'text-[var(--text-dim)] hover:text-[var(--text)]',
              )}
            >
              {z === 'month' ? 'Mois' : z === 'quarter' ? 'Trimestre' : 'Année'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 text-2xs text-[var(--text-dim)]">
        {(['PLANNED', 'IN_PROGRESS', 'DONE', 'DELAYED', 'CANCELLED'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: ACTIVITY_BAR_COLOR[s] }} />
            {ACTIVITY_STATUS[s].label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--outline)]">
        <div style={{ minWidth: NAME_COL + MIN_WIDTH[zoom] }}>
          {/* En-tête */}
          <div className="flex border-b border-[var(--outline)] bg-[var(--surface-2)]">
            <div className="w-44 shrink-0 border-r border-[var(--outline)] px-2 py-1.5 text-2xs font-bold uppercase tracking-wide text-[var(--text-dim)]">
              Activité
            </div>
            <div className="relative h-7 flex-1">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className={clsx(
                    'absolute top-0 h-full border-l border-[var(--outline)]/60 pl-1 text-[10px] leading-7',
                    t.weekend ? 'text-[var(--text-dim)]/60' : 'text-[var(--text-dim)]',
                  )}
                  style={{ left: `${((t.pos.getTime() - start.getTime()) / totalMs) * 100}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Lignes */}
          <div className="relative">
            {todayPct != null && (
              <div
                className="pointer-events-none absolute top-0 z-10 h-full w-px bg-red-500"
                style={{ left: `calc(${NAME_COL}px + (100% - ${NAME_COL}px) * ${todayPct / 100})` }}
              />
            )}
            {rows.map(({ a, s, e, leftPct, widthPct }) => {
              const late = isOverdue(a);
              const visible = leftPct < 100 && leftPct + widthPct > 0;
              return (
                <div key={a.id} className="flex border-b border-[var(--outline)] last:border-b-0">
                  <div className="w-44 shrink-0 truncate border-r border-[var(--outline)] px-2 py-2 text-xs">
                    <span className="block truncate font-medium">{a.title}</span>
                    {a.assignee && (
                      <span className="block truncate text-[10px] text-[var(--text-dim)]">{a.assignee.fullName}</span>
                    )}
                  </div>
                  <div className="relative h-9 flex-1">
                    {ticks.map((t, i) => (
                      <span
                        key={i}
                        className="absolute top-0 h-full border-l border-[var(--outline)]/30"
                        style={{ left: `${((t.pos.getTime() - start.getTime()) / totalMs) * 100}%` }}
                      />
                    ))}
                    {visible && (
                      <div
                        title={`${a.title} · ${fmtShort(s)} → ${fmtShort(e)} · ${a.progress}%${a.assignee ? ' · ' + a.assignee.fullName : ''}`}
                        className={clsx(
                          'absolute top-1.5 h-6 overflow-hidden rounded-md shadow-sm',
                          late && 'ring-2 ring-red-500',
                        )}
                        style={{
                          left: `${Math.max(0, leftPct)}%`,
                          width: `${Math.max(1, Math.min(widthPct + Math.min(0, leftPct), 100 - Math.max(0, leftPct)))}%`,
                          background: `color-mix(in srgb, ${ACTIVITY_BAR_COLOR[a.status]} 40%, var(--surface))`,
                        }}
                      >
                        <div
                          className="h-full rounded-md"
                          style={{
                            width: `${Math.min(100, Math.max(0, a.progress))}%`,
                            background: ACTIVITY_BAR_COLOR[a.status],
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-[var(--text-dim)]">
                Aucune activité datée a afficher sur cette période.
              </div>
            )}
          </div>
        </div>
      </div>
      {withoutDates > 0 && (
        <p className="text-2xs text-[var(--text-dim)]">
          {withoutDates} activité(s) sans date de debut ni d'échéance ne sont pas affichees ici.
        </p>
      )}
    </div>
  );
}
