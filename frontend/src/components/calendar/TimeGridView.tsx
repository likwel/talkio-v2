import { useEffect, useMemo, useRef } from 'react';
import { fmtDayShort, isToday, isSameDay } from '@/lib/date';
import type { CalendarEvent } from '@/lib/types';

interface Props {
  days: Date[];
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onCreateAt: (start: Date) => void;
}

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Positioned {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

/** Repartit les evenements qui se chevauchent en colonnes cote a cote. */
function layoutDay(events: CalendarEvent[], day: Date): Positioned[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const items = events
    .filter((event) => new Date(event.startsAt) < dayEnd && new Date(event.endsAt) > dayStart)
    .map((event) => {
      const s = new Date(event.startsAt).getTime();
      const e = new Date(event.endsAt).getTime();
      const startMin = Math.max(0, (s - dayStart.getTime()) / 60_000);
      const endMin = Math.min(24 * 60, (e - dayStart.getTime()) / 60_000);
      return { event, startMin, endMin: Math.max(endMin, startMin + 20) };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const columns: { end: number }[] = [];
  const placed = items.map((it) => {
    let col = columns.findIndex((c) => c.end <= it.startMin);
    if (col === -1) {
      col = columns.length;
      columns.push({ end: it.endMin });
    } else {
      columns[col].end = it.endMin;
    }
    return { ...it, col };
  });

  const colCount = Math.max(1, columns.length);
  return placed.map((it) => ({
    event: it.event,
    top: (it.startMin / 60) * HOUR_PX,
    height: ((it.endMin - it.startMin) / 60) * HOUR_PX,
    left: (it.col / colCount) * 100,
    width: (1 / colCount) * 100,
  }));
}

export default function TimeGridView({ days, events, onSelectEvent, onCreateAt }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const timed = useMemo(() => events.filter((e) => !e.allDay), [events]);
  const allDay = useMemo(() => events.filter((e) => e.allDay), [events]);

  // Cadrage matinal au premier rendu, comme Google Agenda.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* En-tetes des jours */}
      <div className="flex border-b border-[var(--outline)] pr-4">
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <div key={d.toISOString()} className="flex-1 py-2 text-center">
            <div className="text-2xs uppercase tracking-wide text-[var(--text-dim)]">{fmtDayShort(d)}</div>
            <div
              className={[
                'mx-auto mt-1 grid h-9 w-9 place-items-center rounded-full text-xl',
                isToday(d) ? 'bg-[var(--accent)] font-medium text-white' : 'font-normal text-[var(--text)]',
              ].join(' ')}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Bandeau "journee entiere" */}
      {allDay.length > 0 && (
        <div className="flex border-b border-[var(--outline)] pr-4">
          <div className="flex w-14 shrink-0 items-center justify-end pr-2 text-2xs text-[var(--text-dim)]">jour</div>
          {days.map((d) => (
            <div key={d.toISOString()} className="flex-1 space-y-0.5 p-1">
              {allDay
                .filter((e) => {
                  const dayEnd = new Date(d);
                  dayEnd.setDate(dayEnd.getDate() + 1);
                  const s = new Date(e.startsAt);
                  const end = new Date(e.endsAt);
                  return (s < dayEnd && end > d) || isSameDay(s, d);
                })
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    style={{ backgroundColor: e.color ?? e.calendar.color }}
                    className="block w-full truncate rounded-lg px-2 py-1 text-left text-xs font-medium text-white"
                  >
                    {e.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Grille horaire */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
        <div className="relative w-14 shrink-0">
          {HOURS.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_PX }}>
              <span className="absolute -top-1.5 right-2 text-2xs text-[var(--text-dim)]">
                {h === 0 ? '' : `${h}:00`}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-1">
          {days.map((day) => {
            const positioned = layoutDay(timed, day);
            return (
              <div key={day.toISOString()} className="relative flex-1 border-l border-[var(--outline)]">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-[var(--outline)]/60 transition hover:bg-brand-50/50 dark:hover:bg-white/5"
                    style={{ height: HOUR_PX }}
                    onClick={() => {
                      const start = new Date(day);
                      start.setHours(h, 0, 0, 0);
                      onCreateAt(start);
                    }}
                  />
                ))}

                {positioned.map(({ event, top, height, left, width }) => (
                  <button
                    key={event.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEvent(event);
                    }}
                    style={{
                      top,
                      height,
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      backgroundColor: event.color ?? event.calendar.color,
                    }}
                    className="absolute overflow-hidden rounded-lg px-2 py-1 text-left text-2xs leading-tight text-white shadow-elevation-1 ring-1 ring-black/5 transition hover:shadow-elevation-2"
                  >
                    <div className="font-semibold">{event.title}</div>
                    {height > 28 && (
                      <div className="opacity-90">
                        {new Date(event.startsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
