import { fmtDayShort, isSameDay, isToday, monthGrid } from '@/lib/date';
import type { CalendarEvent } from '@/lib/types';

interface Props {
  anchor: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onCreateAt: (start: Date) => void;
  onPickDay: (d: Date) => void;
}

export default function MonthView({ anchor, events, onSelectEvent, onCreateAt, onPickDay }: Props) {
  const grid = monthGrid(anchor);
  const headRow = grid.slice(0, 7);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--outline)]">
        {headRow.map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-[11px] uppercase tracking-wide text-slate-500">
            {fmtDayShort(d)}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {grid.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const dayEvents = events
            .filter((e) => {
              const s = new Date(e.startsAt);
              const end = new Date(e.endsAt);
              return isSameDay(s, day) || (s <= day && end >= day);
            })
            .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

          return (
            <div
              key={day.toISOString()}
              className="min-h-0 border-b border-r border-[var(--outline)]/70 p-1 transition hover:bg-black/[.02] dark:hover:bg-white/[.03]"
              onClick={() => onCreateAt(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9))}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPickDay(day);
                }}
                className={[
                  'mx-auto grid h-7 w-7 place-items-center rounded-full text-xs transition hover:bg-black/5 dark:hover:bg-white/10',
                  isToday(day) ? 'bg-brand-600 font-medium text-white hover:bg-brand-700' : '',
                  inMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600',
                ].join(' ')}
              >
                {day.getDate()}
              </button>

              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEvent(e);
                    }}
                    className="flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-left text-[11px] transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color ?? e.calendar.color }}
                    />
                    <span className="truncate">
                      {!e.allDay && (
                        <span className="mr-1 text-slate-400">
                          {new Date(e.startsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {e.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} autre(s)</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
